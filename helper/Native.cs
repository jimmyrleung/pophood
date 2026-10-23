using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]

namespace Pophood.Sensors;

internal static unsafe partial class Native
{
    public const uint LOAD_LIBRARY_SEARCH_SYSTEM32 = 0x00000800;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const uint OPEN_EXISTING = 3;

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetDefaultDllDirectories(uint directoryFlags);

    [LibraryImport("kernel32.dll", EntryPoint = "LoadLibraryExW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint LoadLibraryExW(string fileName, nint file, uint flags);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool GetNamedPipeClientProcessId(SafePipeHandle pipe, out uint pid);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    private static partial nint OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint pid);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool QueryFullProcessImageNameW(nint process, uint flags, char* name, ref int size);

    [LibraryImport("kernel32.dll", EntryPoint = "CreateFileW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    private static partial nint CreateFileW(string fileName, uint access, uint share, nint security, uint disposition, uint flags, nint template);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool CloseHandle(nint handle);

    /// <summary>Full image path of a process, or null (the error code is returned in <paramref name="error"/>).</summary>
    public static string? ImagePath(uint pid, out int error)
    {
        error = 0;
        nint h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (h == 0) { error = Marshal.GetLastPInvokeError(); return null; }
        try
        {
            char* buf = stackalloc char[32768];
            int size = 32768;
            if (!QueryFullProcessImageNameW(h, 0, buf, ref size)) { error = Marshal.GetLastPInvokeError(); return null; }
            return new string(buf, 0, size);
        }
        finally { CloseHandle(h); }
    }

    /// <summary>
    /// Opens a device path with desired access 0 (no read, write or ioctl), then closes it.
    /// Used only by the PawnIO device check.
    /// </summary>
    public static bool DeviceOpens(string path)
    {
        nint h = CreateFileW(path, 0, 0, 0, OPEN_EXISTING, 0, 0);
        if (h == 0 || h == -1) return false;
        CloseHandle(h);
        return true;
    }
}
