using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Principal;
using LibreHardwareMonitor.Hardware;

namespace Pophood.Sensors;

/// <summary>
/// Confines the helper's lazily bound P/Invokes to System32 (BUG-T14-01). NativeAOT binds a P/Invoke whose search
/// path is missing, or includes <see cref="DllImportSearchPath.AssemblyDirectory"/> (the framework's default), by
/// loading "&lt;helper folder&gt;\&lt;name&gt;" by full path first, and a full-path load ignores both
/// SetDefaultDllDirectories and KnownDLLs. An assembly's resolver runs before that probe, for each of its lazy
/// P/Invokes; direct (static) calls never reach it.
/// </summary>
internal static class DllSearch
{
    /// <summary>
    /// Every assembly in the published helper with a P/Invoke the compiler bound without a System32-only search path,
    /// read from the ILC map. <c>scripts/build-helper.ps1</c> keeps the same list and fails when a new one appears.
    /// </summary>
    public static readonly Assembly[] Assemblies =
    [
        typeof(object).Assembly,                                              // ntdll, advapi32
        typeof(SecurityIdentifier).Assembly,                                  // advapi32, sspicli
        typeof(Computer).Assembly,                                            // libc, nvidia-ml (Linux only)
        typeof(HidSharp.HidDevice).Assembly,                                  // setupapi, cfgmgr32, user32, hid, BluetoothAPIs
        typeof(DiskInfoToolkit.Storage).Assembly,                             // setupapi, cfgmgr32, user32
        typeof(RAMSPDToolkit.SPD.Enums.PageData).Assembly,                    // setupapi
        typeof(BlackSharp.Core.Converters.DataStorageSizeConverter).Assembly, // kernel32, ntdll
    ];

    /// <summary>Gives every assembly in <see cref="Assemblies"/> the <see cref="Resolve"/> resolver. False if one already has a resolver.</summary>
    public static bool TryConfine()
    {
        try
        {
            foreach (Assembly assembly in Assemblies) NativeLibrary.SetDllImportResolver(assembly, Resolve);
            return true;
        }
        catch (Exception e) when (e is InvalidOperationException or ArgumentException)
        {
            return false;
        }
    }

    /// <summary>
    /// Loads a plain file name with LOAD_LIBRARY_SEARCH_SYSTEM32 (the DLL and its dependencies from System32 only),
    /// whatever search path the P/Invoke asked for. Not <see cref="NativeLibrary.TryLoad(string, Assembly, DllImportSearchPath?, out nint)"/>:
    /// a runtime may probe its own directories before the flag (CoreCLR tries the app folder first). Never returns
    /// zero: zero hands the load back to the runtime's search, helper folder first. A name with a directory part (the
    /// macOS framework paths in HidSharp) is refused.
    /// </summary>
    public static nint Resolve(string name, Assembly assembly, DllImportSearchPath? searchPath)
    {
        if (name.Length > 0 && name.IndexOfAny(['\\', '/', ':']) < 0)
        {
            nint handle = Native.LoadLibraryExW(name, 0, Native.LOAD_LIBRARY_SEARCH_SYSTEM32);
            if (handle != 0) return handle;
        }
        throw new DllNotFoundException($"'{name}' is not a library in System32");
    }
}
