using LibreHardwareMonitor.Hardware;
using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

public class AvailabilityTests
{
    static readonly SensorType[] AllSensorTypes = Enum.GetValues<SensorType>();

    // UT-04
    [Fact]
    public void Unprivileged_Cpu_TrustsOnlyLoad()
    {
        foreach (var type in AllSensorTypes)
            Assert.Equal(type == SensorType.Load, Availability.IsTrustworthy(HardwareType.Cpu, type, pawnIoUsable: false));
    }

    // UT-04
    [Theory]
    [InlineData(HardwareType.Motherboard)]
    [InlineData(HardwareType.SuperIO)]
    [InlineData(HardwareType.EmbeddedController)]
    public void Unprivileged_BoardChips_TrustNothing(HardwareType hardware)
    {
        foreach (var type in AllSensorTypes)
            Assert.False(Availability.IsTrustworthy(hardware, type, pawnIoUsable: false));
    }

    // UT-04
    [Theory]
    [InlineData(HardwareType.Memory)]
    [InlineData(HardwareType.Storage)]
    [InlineData(HardwareType.GpuNvidia)]
    [InlineData(HardwareType.GpuAmd)]
    [InlineData(HardwareType.PowerMonitor)]
    public void Unprivileged_PawnIoFreeHardware_TrustsEverything(HardwareType hardware)
    {
        foreach (var type in AllSensorTypes)
            Assert.True(Availability.IsTrustworthy(hardware, type, pawnIoUsable: false));
    }

    // UT-04: the Intel iGPU's GPU Power comes from the PawnIO MSR module and reads a fake 0 W without it.
    [Fact]
    public void Unprivileged_IntelGpu_TrustsEverythingExceptPower()
    {
        foreach (var type in AllSensorTypes)
            Assert.Equal(type != SensorType.Power, Availability.IsTrustworthy(HardwareType.GpuIntel, type, pawnIoUsable: false));
    }

    // UT-04
    [Fact]
    public void WhenPawnIoIsUsable_EverythingIsTrusted()
    {
        foreach (var hardware in Enum.GetValues<HardwareType>())
            foreach (var type in AllSensorTypes)
                Assert.True(Availability.IsTrustworthy(hardware, type, pawnIoUsable: true));
    }

    // UT-04
    [Theory]
    [InlineData(true, true, true, true)]
    [InlineData(true, true, false, false)] // installed, driver not loaded
    [InlineData(true, false, true, false)]
    [InlineData(true, false, false, false)]
    [InlineData(false, true, true, false)]
    [InlineData(false, true, false, false)]
    [InlineData(false, false, true, false)]
    [InlineData(false, false, false, false)]
    public void PawnIoUsable_IsTrueOnlyWhenElevatedInstalledAndLoaded(bool elevated, bool installed, bool device, bool expected)
    {
        Assert.Equal(expected, Availability.PawnIoUsable(elevated, installed, device));
    }
}
