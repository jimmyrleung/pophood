using System.Diagnostics;
using System.Text.RegularExpressions;
using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

// BUG-T14-01. These run on CoreCLR, so they pin the resolver's own rules; that NativeAOT calls it for every lazy
// P/Invoke, and that the published helper loads nothing from its folder, is shown by the plant check on the AOT build.
public class DllSearchTests
{
    static readonly string System32 = Environment.SystemDirectory;

    static string ModulePath(nint handle) =>
        Process.GetCurrentProcess().Modules.Cast<ProcessModule>().Single(m => m.BaseAddress == handle).FileName;

    [Theory]
    [InlineData("setupapi.dll")]
    [InlineData("cfgmgr32.dll")]
    [InlineData("CFGMGR32.dll")]
    [InlineData("user32.dll")]
    [InlineData("hid.dll")]
    [InlineData("kernel32.dll")]
    [InlineData("ntdll.dll")]
    [InlineData("advapi32.dll")]
    [InlineData("sspicli.dll")]
    [InlineData("setupapi")]
    public void Resolve_LoadsFromSystem32(string name)
    {
        nint handle = DllSearch.Resolve(name, typeof(DllSearch).Assembly, null);

        Assert.NotEqual(0, handle);
        Assert.Equal(System32, Path.GetDirectoryName(ModulePath(handle)), StringComparer.OrdinalIgnoreCase);
    }

    // Zero would hand the load back to the runtime's search (helper folder first), so every refusal is an exception.
    [Theory]
    [InlineData("libc")]
    [InlineData("nvidia-ml")]
    [InlineData("libudev.so.1")]
    [InlineData("/System/Library/Frameworks/IOKit.framework/IOKit")]
    [InlineData(@"C:\Windows\System32\setupapi.dll")]
    [InlineData(@"..\setupapi.dll")]
    [InlineData("sub/setupapi.dll")]
    [InlineData("C:setupapi.dll")]
    [InlineData("")]
    public void Resolve_ThrowsForPathsAndMissingLibraries(string name)
    {
        Assert.Throws<DllNotFoundException>(() => DllSearch.Resolve(name, typeof(DllSearch).Assembly, null));
    }

    // A genuine copy in the test's app folder is the planting case, and the P/Invoke asks for AssemblyDirectory (as the
    // framework's default does): both are ignored. CoreCLR's own NativeLibrary.TryLoad with DllImportSearchPath.System32
    // loads that copy (the host's native search directories come first), which is why Resolve calls LoadLibraryExW
    // itself. No other test loads BluetoothAPIs, so the first load decides.
    [Fact]
    public void Resolve_IgnoresACopyInTheAppFolder()
    {
        Assert.DoesNotContain(Process.GetCurrentProcess().Modules.Cast<ProcessModule>(),
            m => m.ModuleName.Equals("BluetoothAPIs.dll", StringComparison.OrdinalIgnoreCase));
        string plant = Path.Combine(AppContext.BaseDirectory, "BluetoothAPIs.dll");
        File.Copy(Path.Combine(System32, "BluetoothAPIs.dll"), plant, overwrite: true);
        try
        {
            nint handle = DllSearch.Resolve("BluetoothAPIs.dll", typeof(DllSearch).Assembly,
                System.Runtime.InteropServices.DllImportSearchPath.AssemblyDirectory);

            Assert.Equal(System32, Path.GetDirectoryName(ModulePath(handle)), StringComparer.OrdinalIgnoreCase);
        }
        finally
        {
            File.Delete(plant);
        }
    }

    // $confined in scripts/build-helper.ps1 is the list the build checks against the ILC map. Both lists are kept by hand,
    // so a name added to only one of them would leave an assembly unconfined while the build passes.
    [Fact]
    public void Assemblies_MatchTheBuildScriptList()
    {
        string script = File.ReadAllText(Path.Combine(RepoRoot(), "scripts", "build-helper.ps1"));
        string list = Regex.Match(script, @"^\$confined = (.+?)\r?\n\$", RegexOptions.Multiline | RegexOptions.Singleline).Groups[1].Value;
        string[] confined = Regex.Matches(list, "'([^']+)'").Select(m => m.Groups[1].Value).ToArray();

        Assert.NotEmpty(confined);
        Assert.Equal(confined.Order(), DllSearch.Assemblies.Select(a => IlcName(a.GetName().Name!)).Order());
    }

    // How the ILC map names an assembly: "System.Private." becomes "S_P_", and '.' and '-' become '_'.
    static string IlcName(string name) =>
        Regex.Replace(name.StartsWith("System.Private.") ? "S_P_" + name["System.Private.".Length..] : name, @"[.\-]", "_");

    static string RepoRoot()
    {
        for (DirectoryInfo? dir = new(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "scripts", "build-helper.ps1"))) return dir.FullName;
        }
        throw new DirectoryNotFoundException($"No scripts\\build-helper.ps1 above {AppContext.BaseDirectory}");
    }
}
