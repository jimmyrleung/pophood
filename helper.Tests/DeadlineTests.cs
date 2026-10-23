using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

public class DeadlineTests
{
    // UT-05
    [Fact]
    public void Next_StepsOnePeriod_WhenNotLate()
    {
        Assert.Equal(2000, Deadline.Next(1000, 1000, 1100));
    }

    // UT-05
    [Fact]
    public void Next_SkipsMissedTicks_AndKeepsThePhase()
    {
        // Deadlines are 0, 1000, 2000, ...; at 2500 the 1000 and 2000 ticks are already missed.
        Assert.Equal(3000, Deadline.Next(0, 1000, 2500));
        Assert.Equal(3000, Deadline.Next(1000, 1000, 2500));
    }

    // UT-05
    [Fact]
    public void Next_DoesNotSkipATickThatIsDueNow()
    {
        Assert.Equal(2000, Deadline.Next(1000, 1000, 2000));
    }

    // UT-05: stepping from the wake time would add ~15 ms per tick; stepping from the deadline adds none.
    [Fact]
    public void LateWakeUps_DoNotDrift()
    {
        long deadline = 0;
        for (int i = 1; i <= 100; i++)
        {
            long wake = deadline + 15; // every wake-up is 15 ms late
            deadline = Deadline.Next(deadline, 1000, wake);
            Assert.Equal(i * 1000L, deadline);
        }
    }

    // UT-05
    [Fact]
    public void AfterPeriodChange_IsOnePeriodAfterTheLastTick()
    {
        Assert.Equal(5250, Deadline.AfterPeriodChange(5000, 250, 5100));
        Assert.Equal(6000, Deadline.AfterPeriodChange(5000, 1000, 5100));
    }

    // UT-05
    [Fact]
    public void AfterPeriodChange_IsNeverInThePast()
    {
        Assert.Equal(7000, Deadline.AfterPeriodChange(5000, 250, 7000));
    }
}
