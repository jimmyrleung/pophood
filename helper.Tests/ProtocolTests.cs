using System.Text;
using System.Text.Json;
using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

public class ProtocolTests
{
    static string Line<T>(T message, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> info)
    {
        var stream = new MemoryStream();
        new MessageWriter(stream).Send(message, info);
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    static Frame SampleFrame() => new()
    {
        Seq = 42,
        T = 1761040800123,
        PeriodMs = 1000,
        Memory = [new MemoryModule("DIMM 1", 16, "DDR5", 6000)],
        Hardware = [new HardwareInfo("/amdcpu/0", "AMD Ryzen 9 9900X", "Cpu", null)],
        Sensors =
        [
            new SensorInfo("/amdcpu/0/temperature/2", "/amdcpu/0", "Core (Tctl/Tdie)", "Temperature", 2, null),
            new SensorInfo("/amdcpu/0/load/0", "/amdcpu/0", "CPU Total", "Load", 0, 12.3f),
        ],
    };

    // UT-06
    [Fact]
    public void Frame_StartsWithVersionAndType_AndIsOneLine()
    {
        var line = Line(SampleFrame(), HelperJson.Default.Frame);
        Assert.StartsWith("""{"v":1,"type":"frame",""", line);
        Assert.EndsWith("\n", line);
        Assert.Single(line.TrimEnd('\n').Split('\n'));
    }

    // UT-06
    [Fact]
    public void Frame_UsesCamelCase_AndKeepsNullValues()
    {
        var line = Line(SampleFrame(), HelperJson.Default.Frame);
        Assert.Contains("\"value\":null", line);
        Assert.Contains("\"value\":12.3", line);
        Assert.Contains("\"periodMs\":1000", line);
        Assert.Contains("\"configuredMTs\":6000", line);
        Assert.Contains("\"sizeGB\":16", line);
        Assert.Contains("\"parent\":null", line);
        Assert.DoesNotContain("Seq", line);
        Assert.DoesNotContain("PeriodMs", line);
    }

    // UT-06
    [Fact]
    public void MemoryModule_HasNoSerialNumberField()
    {
        using var doc = JsonDocument.Parse(Line(SampleFrame(), HelperJson.Default.Frame));
        var module = doc.RootElement.GetProperty("memory")[0];
        var names = module.EnumerateObject().Select(p => p.Name).ToArray();
        Assert.Equal(["locator", "sizeGB", "type", "configuredMTs"], names);
        Assert.DoesNotContain("serial", Line(SampleFrame(), HelperJson.Default.Frame), StringComparison.OrdinalIgnoreCase);
    }

    // UT-06
    [Fact]
    public void Hello_MatchesTheSpecExample()
    {
        var hello = new Hello { Elevated = false, PawnIo = new PawnIoInfo(true, "2.2.0.0", null) };
        Assert.Equal(
            """{"v":1,"type":"hello","elevated":false,"pawnIo":{"installed":true,"version":"2.2.0.0","loaded":null}}""" + "\n",
            Line(hello, HelperJson.Default.Hello));
    }

    // UT-06
    [Fact]
    public void AckAndError_MatchTheSpecExamples()
    {
        Assert.Equal("""{"v":1,"type":"ack","periodMs":250}""" + "\n", Line(new Ack { PeriodMs = 250 }, HelperJson.Default.Ack));
        Assert.Equal(
            """{"v":1,"type":"error","code":"out_of_range","detail":"ms must be 250..1000"}""" + "\n",
            Line(new ErrorMessage { Code = "out_of_range", Detail = "ms must be 250..1000" }, HelperJson.Default.ErrorMessage));
    }

    [Fact]
    public void ConsecutiveSends_ProduceSeparateLines()
    {
        var stream = new MemoryStream();
        var writer = new MessageWriter(stream);
        writer.Send(new Ack { PeriodMs = 250 }, HelperJson.Default.Ack);
        writer.Reply("too_long", "x");
        var lines = Encoding.UTF8.GetString(stream.ToArray()).Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length);
        Assert.StartsWith("""{"v":1,"type":"ack",""", lines[0]);
        Assert.StartsWith("""{"v":1,"type":"error",""", lines[1]);
    }
}
