using LibreHardwareMonitor.Hardware;

namespace Pophood.Sensors;

internal sealed record FrameBody(MemoryModule[] Memory, HardwareInfo[] Hardware, SensorInfo[] Sensors);

/// <summary>
/// Owns the LHM <see cref="Computer"/>. Every call the helper makes into LHM happens on the sampler thread
/// (<c>ThreadAffinity.Set</c> changes the calling thread's affinity, so one dedicated OS thread is required).
/// LHM itself also mutates its hardware lists on other threads (the DIMM retry, storage hot-plug), so an exception
/// from <see cref="UpdateAndSnapshot"/> is handled by the sampler, not prevented here.
/// </summary>
internal sealed class SensorReader : IDisposable
{
    readonly Computer _computer;
    readonly bool _pawnIoUsable;
    readonly MemoryModule[] _memory;
    // Identifier.ToString() allocates on every call, so each hardware and sensor is converted once.
    readonly Dictionary<object, string> _ids = new(ReferenceEqualityComparer.Instance);

    /// <summary>
    /// Exactly six toggles (answers #19 and #30). <c>IsControllerEnabled</c> stays off because controllers write
    /// fans at Open/Close; Network, PSU and Battery stay off too. No <c>ISettings</c>: a persisting store would replay
    /// saved fan values at Open. BannedSymbols.txt bans those APIs.
    /// </summary>
    public static Computer CreateComputer() => new()
    {
        IsCpuEnabled = true,
        IsGpuEnabled = true,
        IsMemoryEnabled = true,
        IsMotherboardEnabled = true,
        IsStorageEnabled = true,
        IsPowerMonitorEnabled = true,
    };

    /// <summary>Opens the computer. Call it on the sampler thread. Throws if LHM cannot open.</summary>
    public SensorReader(Computer computer, bool pawnIoUsable)
    {
        _computer = computer;
        _pawnIoUsable = pawnIoUsable;
        computer.Open();
        _memory = ReadMemoryModules(computer);
    }

    public FrameBody UpdateAndSnapshot()
    {
        var hardware = new List<HardwareInfo>();
        var sensors = new List<SensorInfo>();
        // Computer.Hardware returns a new list built under LHM's lock, and there is no Computer.Update().
        foreach (var hw in _computer.Hardware) Walk(hw, null, hardware, sensors);
        return new FrameBody(_memory, hardware.ToArray(), sensors.ToArray());
    }

    void Walk(IHardware hw, string? parentId, List<HardwareInfo> hardware, List<SensorInfo> sensors)
    {
        hw.Update();
        string hwId = Id(hw, hw.Identifier);
        hardware.Add(new HardwareInfo(hwId, hw.Name, hw.HardwareType.ToString(), parentId));

        foreach (var sensor in hw.Sensors)
        {
            // Lazily created SuperIO sensors and late DIMMs arrive with LHM's default window (one day of history).
            if (sensor.ValuesTimeWindow != TimeSpan.Zero) sensor.ValuesTimeWindow = TimeSpan.Zero;

            float? value = sensor.Value;
            if (value is { } v && !float.IsFinite(v)) value = null;
            if (!Availability.IsTrustworthy(hw.HardwareType, sensor.SensorType, _pawnIoUsable)) value = null;

            sensors.Add(new SensorInfo(Id(sensor, sensor.Identifier), hwId, sensor.Name,
                sensor.SensorType.ToString(), sensor.Index, value));
        }

        foreach (var sub in hw.SubHardware) Walk(sub, hwId, hardware, sensors);
    }

    string Id(object owner, Identifier identifier)
    {
        if (!_ids.TryGetValue(owner, out var id)) _ids[owner] = id = identifier.ToString();
        return id;
    }

    /// <summary>
    /// SMBIOS memory devices (unprivileged). LHM reads <c>Size</c> in MiB and extends it through the 32-bit field when
    /// the 16-bit one is 0x7FFF, so a 32 GiB module arrives as 32768 with bit 15 set. Only 0 (empty socket) and
    /// 0xFFFF (unknown) are skipped. Serial numbers are never read.
    /// </summary>
    static MemoryModule[] ReadMemoryModules(Computer computer)
    {
        var devices = computer.SMBios.MemoryDevices ?? [];
        var modules = new List<MemoryModule>();
        foreach (var device in devices)
        {
            if (device.Size == 0 || device.Size == 0xFFFF) continue;
            modules.Add(new MemoryModule(
                device.DeviceLocator,
                device.Size / 1024.0,
                device.Type.ToString(),
                device.ConfiguredSpeed == 0 ? null : device.ConfiguredSpeed));
        }
        return modules.ToArray();
    }

    public void Dispose()
    {
        try { _computer.Close(); }
        catch (Exception)
        {
            // The process is about to exit; a failing Close must not mask the exit code.
        }
    }
}
