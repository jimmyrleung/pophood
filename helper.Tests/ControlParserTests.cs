using System.Text;
using Pophood.Sensors;
using Xunit;

namespace Pophood.Sensors.Tests;

public class ControlParserTests
{
    static byte[] Utf8(string s) => Encoding.UTF8.GetBytes(s);

    static ControlResult Parse(string json) => ControlParser.Parse(Utf8(json));

    // UT-01
    [Theory]
    [InlineData(250)]
    [InlineData(1000)]
    [InlineData(500)]
    public void SetPeriod_IsAccepted_AtAndBetweenTheBounds(int ms)
    {
        var result = Parse($$"""{"v":1,"type":"set_period","ms":{{ms}}}""");
        Assert.Equal(new Accepted(ms), result);
    }

    // UT-01
    [Theory]
    [InlineData(249)]
    [InlineData(1001)]
    public void SetPeriod_IsRejected_JustOutsideTheBounds(int ms)
    {
        var result = Assert.IsType<Rejected>(Parse($$"""{"v":1,"type":"set_period","ms":{{ms}}}"""));
        Assert.Equal("out_of_range", result.Code);
    }

    // UT-02: the 21 parser cases from P2's corpus (probe-pipe/client/src/main.rs fuzz()), each pinned to the code
    // P2's ParseControl returned (probe-pipe/out/logs/run-all.txt). The 22nd case, a 1 MiB line, never reaches the
    // parser (the read loop answers too_long); IT-05 covers it.
    public static TheoryData<string, byte[], string> P2Corpus => new()
    {
        { "empty line", Array.Empty<byte>(), "bad_json" },
        { "plain text", Utf8("hello"), "bad_json" },
        { "truncated json", Utf8("{"), "bad_json" },
        { "array", Utf8("[1,2,3]"), "not_object" },
        { "string", Utf8("\"str\""), "not_object" },
        { "wrong version", Utf8("""{"v":2,"type":"set_period","ms":250}"""), "bad_version" },
        { "missing version", Utf8("""{"type":"set_period","ms":250}"""), "bad_version" },
        { "unknown type", Utf8("""{"v":1,"type":"reboot"}"""), "unknown_type" },
        { "ms as string", Utf8("""{"v":1,"type":"set_period","ms":"250"}"""), "bad_field" },
        { "ms negative", Utf8("""{"v":1,"type":"set_period","ms":-5}"""), "out_of_range" },
        { "ms too fast", Utf8("""{"v":1,"type":"set_period","ms":10}"""), "out_of_range" },
        { "ms 1e30", Utf8("""{"v":1,"type":"set_period","ms":1e30}"""), "bad_field" },
        { "ms fractional", Utf8("""{"v":1,"type":"set_period","ms":250.5}"""), "bad_field" },
        { "extra field", Utf8("""{"v":1,"type":"set_period","ms":250,"x":1}"""), "unknown_field" },
        { "duplicate field", Utf8("""{"v":1,"type":"set_period","ms":250,"ms":10}"""), "bad_json" },
        { "deep nesting", Utf8("""{"v":1,"type":"set_period","ms":{"a":{"b":[[[1]]]}}}"""), "bad_json" },
        { "invalid utf-8", [.. "{\"v\":1,\"type\":\""u8, 0xff, 0xfe, .. "\"}"u8], "bad_encoding" },
        { "bad utf-8 name", [.. "{\"v\":1,\""u8, 0xc3, 0x28, .. "\":1}"u8], "bad_encoding" },
        { "lone surrogate", Utf8("""{"v":1,"type":"\ud800"}"""), "internal_error" },
        { "CRLF + BOM", [0xef, 0xbb, 0xbf, .. "{\"v\":1,\"type\":\"set_period\",\"ms\":5}\r"u8], "bad_json" },
        { "NUL bytes", new byte[] { 0, 0, 0, 0 }, "bad_json" },
    };

    [Theory]
    [MemberData(nameof(P2Corpus))]
    public void P2Case_IsRejected_WithItsPinnedCode(string name, byte[] line, string expectedCode)
    {
        var result = Assert.IsType<Rejected>(ControlParser.Parse(line));
        Assert.True(result.Code == expectedCode, $"{name}: expected {expectedCode}, got {result.Code} ({result.Detail})");
    }

    [Fact]
    public void P2Corpus_Has21Cases()
    {
        Assert.Equal(21, P2Corpus.Count());
    }

    // UT-03
    [Fact]
    public void LoneSurrogate_ReturnsInternalError_WithTheExceptionTypeName()
    {
        var result = Assert.IsType<Rejected>(Parse("""{"v":1,"type":"\ud800"}"""));
        Assert.Equal("internal_error", result.Code);
        Assert.Equal("InvalidOperationException", result.Detail);
    }

    // UT-03
    [Fact]
    public void RandomBytes_NeverThrow()
    {
        var rng = new Random(12345);
        var buffer = new byte[200];
        for (int i = 0; i < 5000; i++)
        {
            rng.NextBytes(buffer);
            var length = rng.Next(buffer.Length + 1);
            var result = ControlParser.Parse(buffer.AsSpan(0, length));
            Assert.NotNull(result);
        }
    }

    // UT-03
    [Fact]
    public void MutatedValidMessages_NeverThrow()
    {
        byte[] valid = Utf8("""{"v":1,"type":"set_period","ms":250}""");
        var rng = new Random(7);
        for (int i = 0; i < 5000; i++)
        {
            var mutated = (byte[])valid.Clone();
            for (int k = 0; k < 3; k++) mutated[rng.Next(mutated.Length)] = (byte)rng.Next(256);
            Assert.NotNull(ControlParser.Parse(mutated));
        }
    }

    [Fact]
    public void TrailingCarriageReturn_IsIgnored()
    {
        Assert.Equal(new Accepted(300), ControlParser.Parse(Utf8("""{"v":1,"type":"set_period","ms":300}""" + "\r")));
    }
}
