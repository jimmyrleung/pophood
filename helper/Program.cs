using System.IO.Pipes;
using System.Security.Principal;
using System.Text.RegularExpressions;
using LibreHardwareMonitor.PawnIo;

namespace Pophood.Sensors;

/// <summary>State shared by the read loop (main thread) and the sampler thread.</summary>
internal sealed class Session
{
    readonly Stream _pipe;
    int _periodMs = 1000;
    int _exitCode = Program.ExitOk;
    int _stopped;

    public Session(Stream pipe)
    {
        _pipe = pipe;
        Writer = new MessageWriter(pipe);
    }

    public MessageWriter Writer { get; }
    public CancellationTokenSource Life { get; } = new();
    public AutoResetEvent PeriodChanged { get; } = new(false);
    public int PeriodMs => Volatile.Read(ref _periodMs);
    public int ExitCode => Volatile.Read(ref _exitCode);

    public void SetPeriod(int ms)
    {
        Volatile.Write(ref _periodMs, ms);
        PeriodChanged.Set();
    }

    /// <summary>
    /// Ends the session from any thread. The first caller decides the exit code. Disposing the pipe wakes the read
    /// loop, which is otherwise blocked in a read.
    /// </summary>
    public void Stop(int exitCode)
    {
        if (Interlocked.Exchange(ref _stopped, 1) == 0) Volatile.Write(ref _exitCode, exitCode);
        Life.Cancel();
        _pipe.Dispose();
    }
}

internal static partial class Program
{
    public const int ExitOk = 0;
    public const int ExitPipeTaken = 3;
    public const int ExitNoClient = 4;
    public const int ExitBadArgs = 64;
    public const int ExitInternal = 70;

    const int MaxControlLine = 1024;
    static readonly TimeSpan AcceptWindow = TimeSpan.FromSeconds(30);

    [GeneratedRegex("^pophood-[0-9a-f]{32}$")]
    private static partial Regex PipeNamePattern();

    public static int Main(string[] args)
    {
        // Must run before anything can load a vendor DLL by bare name: LHM loads nvapi64, atiadlxx, ControlLib and
        // nvml that way, application directory first, so a DLL planted next to the helper would run elevated.
        if (!Native.SetDefaultDllDirectories(Native.LOAD_LIBRARY_SEARCH_SYSTEM32)) return ExitInternal;
        // Then, before the first lazy P/Invoke (the pipe setup binds ntdll): LHM's packages and the framework would
        // load their P/Invoke DLLs from the helper's folder by full path, which the call above doesn't restrict.
        if (!DllSearch.TryConfine()) return ExitInternal;
        // LHM's NVML fallback loads "%ProgramW6432%\NVIDIA Corporation\NVSMI\nvml.dll", and a same-user value in
        // HKCU\Environment sets ProgramW6432 for the elevated helper. The Program Files known folder ignores the environment.
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        if (programFiles.Length == 0) return ExitInternal;
        Environment.SetEnvironmentVariable("ProgramW6432", programFiles);

        if (!TryParseArgs(args, out string pipeName, out string client)) return ExitBadArgs;

        try
        {
            return Run(pipeName, client);
        }
        catch (Exception)
        {
            return ExitInternal;
        }
    }

    static bool TryParseArgs(string[] args, out string pipeName, out string client)
    {
        pipeName = "";
        client = "";
        if (args.Length != 4) return false;
        bool havePipe = false, haveClient = false;
        for (int i = 0; i < args.Length; i += 2)
        {
            string value = args[i + 1];
            switch (args[i])
            {
                case "--pipe" when !havePipe:
                    if (!PipeNamePattern().IsMatch(value)) return false;
                    pipeName = value;
                    havePipe = true;
                    break;
                case "--client" when !haveClient:
                    if (!Path.IsPathFullyQualified(value)) return false;
                    client = Path.GetFullPath(value);
                    haveClient = true;
                    break;
                default:
                    return false;
            }
        }
        return havePipe && haveClient;
    }

    static int Run(string pipeName, string client)
    {
        NamedPipeServerStream pipe;
        try { pipe = PipeServer.Create(pipeName); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return ExitPipeTaken; }

        using (pipe)
        {
            if (!PipeServer.AcceptVerifiedClient(pipe, client, AcceptWindow)) return ExitNoClient;

            // Evaluated once, before LHM opens. The device check runs only when elevated (the PawnIO device ACL
            // is SYSTEM and Administrators).
            bool elevated = IsElevated();
            bool installed = PawnIo.IsInstalled;
            bool? loaded = elevated ? Availability.PawnIoDevicePresent() : null;
            bool pawnIoUsable = Availability.PawnIoUsable(elevated, installed, loaded == true);

            var session = new Session(pipe);
            Thread? sampler = null;
            try
            {
                session.Writer.Send(new Hello
                {
                    Elevated = elevated,
                    PawnIo = new PawnIoInfo(installed, PawnIo.Version?.ToString(), loaded),
                }, HelperJson.Default.Hello);
                sampler = Sampler.Start(session, pawnIoUsable);
                ReadLoop(pipe, session);
            }
            catch (Exception e) when (e is IOException or ObjectDisposedException or OperationCanceledException)
            {
                // The client went away (EOF, broken pipe), or the sampler ended the session: the lifetime ends here.
            }
            finally
            {
                session.Stop(ExitOk);
                // Let the sampler close LHM before the process exits; the app terminates the helper after its own grace.
                sampler?.Join(TimeSpan.FromSeconds(4));
            }
            return session.ExitCode;
        }
    }

    static bool IsElevated()
    {
        using var identity = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }

    /// <summary>
    /// Reads control lines of at most <see cref="MaxControlLine"/> bytes. A longer line is dropped up to its
    /// newline and answered with <c>too_long</c>, so memory use stays bounded whatever the client sends.
    /// </summary>
    static void ReadLoop(Stream pipe, Session session)
    {
        var buffer = new byte[4096];
        var line = new byte[MaxControlLine];
        int length = 0;
        bool overflow = false;
        while (true)
        {
            int n = pipe.Read(buffer, 0, buffer.Length);
            if (n == 0) return;
            for (int i = 0; i < n; i++)
            {
                byte b = buffer[i];
                if (b == (byte)'\n')
                {
                    if (overflow) session.Writer.Reply("too_long", $"line exceeded {MaxControlLine} bytes");
                    else Handle(line.AsSpan(0, length), session);
                    length = 0;
                    overflow = false;
                }
                else if (overflow)
                {
                }
                else if (length == MaxControlLine) overflow = true;
                else line[length++] = b;
            }
        }
    }

    static void Handle(ReadOnlySpan<byte> line, Session session)
    {
        switch (ControlParser.Parse(line))
        {
            case Accepted accepted:
                session.SetPeriod(accepted.PeriodMs);
                session.Writer.Send(new Ack { PeriodMs = accepted.PeriodMs }, HelperJson.Default.Ack);
                break;
            case Rejected rejected:
                session.Writer.Reply(rejected.Code, rejected.Detail);
                break;
        }
    }
}
