using System.Diagnostics;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;

namespace Pophood.Sensors;

internal static class PipeServer
{
    /// <summary>
    /// Creates the first and only instance of the pipe, readable and writable by the current user only.
    /// Throws <see cref="IOException"/> or <see cref="UnauthorizedAccessException"/> when the name is already taken.
    /// </summary>
    public static NamedPipeServerStream Create(string pipeName)
    {
        using var identity = WindowsIdentity.GetCurrent();
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(identity.User!, PipeAccessRights.ReadWrite, AccessControlType.Allow));
        return NamedPipeServerStreamAcl.Create(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous | PipeOptions.FirstPipeInstance, 4096, 65536, security);
    }

    /// <summary>
    /// Waits for a client whose image path equals <paramref name="expectedClient"/>. A client with another path is
    /// disconnected (nothing read or written) and the same instance keeps listening, inside one fixed window.
    /// Returns false when the window ends first.
    /// </summary>
    public static bool AcceptVerifiedClient(NamedPipeServerStream pipe, string expectedClient, TimeSpan remaining)
    {
        string expected = Path.GetFullPath(expectedClient);
        var window = Stopwatch.StartNew();
        while (true)
        {
            var left = remaining - window.Elapsed;
            if (left <= TimeSpan.Zero) return false;
            using (var cts = new CancellationTokenSource(left))
            {
                try { pipe.WaitForConnectionAsync(cts.Token).GetAwaiter().GetResult(); }
                catch (OperationCanceledException) { return false; }
            }
            if (IsExpectedClient(pipe, expected)) return true;
            pipe.Disconnect();
        }
    }

    static bool IsExpectedClient(NamedPipeServerStream pipe, string expected)
    {
        if (!Native.GetNamedPipeClientProcessId(pipe.SafePipeHandle, out uint pid)) return false;
        string? path = Native.ImagePath(pid, out _);
        return path is not null && string.Equals(Path.GetFullPath(path), expected, StringComparison.OrdinalIgnoreCase);
    }
}
