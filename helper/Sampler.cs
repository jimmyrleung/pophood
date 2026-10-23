using System.Diagnostics;

namespace Pophood.Sensors;

/// <summary>
/// The sampler thread: sole owner of the LHM <see cref="Computer"/>. Sends the first frame right after Open, then one
/// frame per period on a deadline schedule. Frames are stamped with the tick's start, so frame-to-frame deltas show the
/// schedule and not the time Update() took.
/// </summary>
internal static class Sampler
{
    const int MaxConsecutiveFailures = 5;

    public static Thread Start(Session session, bool pawnIoUsable)
    {
        var thread = new Thread(() => Run(session, pawnIoUsable)) { Name = "sampler", IsBackground = true };
        thread.Start();
        return thread;
    }

    static void Run(Session session, bool pawnIoUsable)
    {
        SensorReader reader;
        try
        {
            reader = new SensorReader(SensorReader.CreateComputer(), pawnIoUsable);
        }
        catch (Exception e)
        {
            Fatal(session, e);
            return;
        }

        using (reader)
        {
            var clock = Stopwatch.StartNew();
            long unixAtStart = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var wait = new WaitHandle[] { session.PeriodChanged, session.Life.Token.WaitHandle };

            long next = 0;
            long lastTick = 0;
            long seq = 0;
            int failures = 0;

            while (!session.Life.IsCancellationRequested)
            {
                long remaining = next - clock.ElapsedMilliseconds;
                if (remaining > 0)
                {
                    int signalled = WaitHandle.WaitAny(wait, (int)remaining);
                    if (signalled == 1) break;
                    if (signalled == 0)
                    {
                        next = Deadline.AfterPeriodChange(lastTick, session.PeriodMs, clock.ElapsedMilliseconds);
                        continue;
                    }
                }

                long tick = clock.ElapsedMilliseconds;
                lastTick = tick;

                FrameBody? body = null;
                try
                {
                    body = reader.UpdateAndSnapshot();
                    failures = 0;
                }
                catch (Exception e)
                {
                    if (++failures >= MaxConsecutiveFailures)
                    {
                        Fatal(session, e);
                        return;
                    }
                }

                if (body is not null)
                {
                    try
                    {
                        session.Writer.Send(new Frame
                        {
                            Seq = ++seq,
                            T = unixAtStart + tick,
                            PeriodMs = session.PeriodMs,
                            Memory = body.Memory,
                            Hardware = body.Hardware,
                            Sensors = body.Sensors,
                        }, HelperJson.Default.Frame);
                    }
                    catch (Exception e) when (e is IOException or ObjectDisposedException)
                    {
                        session.Stop(Program.ExitOk);
                        break;
                    }
                }

                next = Deadline.Next(next, session.PeriodMs, clock.ElapsedMilliseconds);
            }
        }
    }

    /// <summary>LHM failed to open, or kept failing: tell the app once, then end the process with exit code 70.</summary>
    static void Fatal(Session session, Exception e)
    {
        try { session.Writer.Reply("lhm_failed", e.GetType().Name); }
        catch (Exception)
        {
            // The client is already gone; the exit code still says why.
        }
        session.Stop(Program.ExitInternal);
    }
}
