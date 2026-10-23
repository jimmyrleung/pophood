using LibreHardwareMonitor.Hardware;
using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

public class SensorReaderTests
{
    // UT-33: this project is not analysed by BannedApiAnalyzers, so it may read the banned properties.
    [Fact]
    public void CreateComputer_EnablesExactlyTheSixToggles()
    {
        var computer = SensorReader.CreateComputer();

        Assert.True(computer.IsCpuEnabled);
        Assert.True(computer.IsGpuEnabled);
        Assert.True(computer.IsMemoryEnabled);
        Assert.True(computer.IsMotherboardEnabled);
        Assert.True(computer.IsStorageEnabled);
        Assert.True(computer.IsPowerMonitorEnabled);

        Assert.False(computer.IsControllerEnabled);
        Assert.False(computer.IsNetworkEnabled);
        Assert.False(computer.IsPsuEnabled);
        Assert.False(computer.IsBatteryEnabled);
    }

    static IEnumerable<ISensor> AllSensors(IEnumerable<IHardware> hardware)
    {
        foreach (var hw in hardware)
        {
            foreach (var sensor in hw.Sensors) yield return sensor;
            foreach (var sensor in AllSensors(hw.SubHardware)) yield return sensor;
        }
    }

    // UT-36: LHM keeps one history value every 4 updates for a day unless the window is reset.
    [Fact]
    public void ValuesTimeWindow_IsZeroAndValuesEmpty_AfterManyUpdates()
    {
        var computer = new Computer { IsMemoryEnabled = true };
        using var reader = new SensorReader(computer, pawnIoUsable: false);

        FrameBody body = null!;
        for (int i = 0; i < 20; i++) body = reader.UpdateAndSnapshot();

        var sensors = AllSensors(computer.Hardware).ToList();
        Assert.NotEmpty(sensors);
        Assert.All(sensors, s =>
        {
            Assert.Equal(TimeSpan.Zero, s.ValuesTimeWindow);
            Assert.Empty(s.Values);
        });
        Assert.Equal(sensors.Count, body.Sensors.Length);
    }

    [Fact]
    public void Snapshot_ListsMemoryHardwareAndAMemoryUsedSensor()
    {
        using var reader = new SensorReader(new Computer { IsMemoryEnabled = true }, pawnIoUsable: false);
        var body = reader.UpdateAndSnapshot();

        Assert.Contains(body.Hardware, h => h.Id == "/ram" && h.Type == "Memory" && h.Parent is null);
        Assert.Contains(body.Sensors, s => s.Id == "/ram/data/0" && s.Name == "Memory Used" && s.Value > 0);
        Assert.All(body.Sensors, s => Assert.Contains(body.Hardware, h => h.Id == s.Hw));
    }

    [Fact]
    public void MemoryModules_HaveNoNegativeOrZeroSizes()
    {
        using var reader = new SensorReader(new Computer { IsMemoryEnabled = true }, pawnIoUsable: false);
        var body = reader.UpdateAndSnapshot();

        Assert.All(body.Memory, m =>
        {
            Assert.True(m.SizeGB > 0);
            Assert.NotEmpty(m.Locator);
            Assert.True(m.ConfiguredMTs is null or > 0);
        });
    }
}
