using LibreHardwareMonitor.Hardware;

namespace Pophood.Sensors;

/// <summary>
/// RF3: decides which readings can be trusted. Without a usable PawnIO, LHM substitutes a handle that returns
/// zero-filled buffers, so many sensors report fake zeros (AMD 0 °C / 0 W / 1.55 V, Intel package power 0 W).
/// The helper owns validity: an untrustworthy reading is sent as <c>null</c>, never as a value.
/// </summary>
internal static class Availability
{
    const string PawnIoDevicePath = @"\\?\GLOBALROOT\Device\PawnIO";

    /// <summary>True only for an elevated helper with PawnIO installed and its driver loaded.</summary>
    public static bool PawnIoUsable(bool elevated, bool installed, bool devicePresent) =>
        elevated && installed && devicePresent;

    /// <summary>
    /// Elevated only (the device ACL is SYSTEM and Administrators): the PawnIO device opens only when its driver is
    /// loaded. LHM has no public "driver loaded" check, and an installed-but-dead PawnIO would let fake zeros through.
    /// </summary>
    public static bool PawnIoDevicePresent() => Native.DeviceOpens(PawnIoDevicePath);

    public static bool IsTrustworthy(HardwareType hardware, SensorType sensor, bool pawnIoUsable)
    {
        if (pawnIoUsable) return true;
        return hardware switch
        {
            // Load comes from NtQuerySystemInformation; temperature, power, clocks and VID come through PawnIO.
            HardwareType.Cpu => sensor == SensorType.Load,
            // Read through the PawnIO LPC / EC modules: absent or zero without it.
            HardwareType.Motherboard or HardwareType.SuperIO or HardwareType.EmbeddedController => false,
            // GPU Power comes from the PawnIO MSR module and reads a fake 0 W without it.
            HardwareType.GpuIntel => sensor != SensorType.Power,
            // Memory (/ram, /vram), Storage, NVIDIA, AMD and the rest do not use PawnIO.
            _ => true,
        };
    }
}
