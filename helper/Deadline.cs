namespace Pophood.Sensors;

/// <summary>
/// Pure deadline maths for the sampler (RF4). The next deadline steps from the previous deadline, never from the
/// measured wake time: stepping from the wake time adds the scheduler's lateness (up to ~15.6 ms at the default timer
/// resolution) to every tick, and the schedule drifts.
/// </summary>
internal static class Deadline
{
    /// <summary>The deadline after <paramref name="previousDeadlineMs"/>, skipping ticks that are already in the past.</summary>
    public static long Next(long previousDeadlineMs, long periodMs, long nowMs)
    {
        long next = previousDeadlineMs + periodMs;
        while (next < nowMs) next += periodMs;
        return next;
    }

    /// <summary>The deadline after a period change: one new period after the last tick, but never in the past.</summary>
    public static long AfterPeriodChange(long lastTickMs, long newPeriodMs, long nowMs) =>
        Math.Max(lastTickMs + newPeriodMs, nowMs);
}
