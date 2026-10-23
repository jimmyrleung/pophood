using System.Buffers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace Pophood.Sensors;

internal static class Protocol
{
    public const int SchemaVersion = 1;
}

// Every message declares V and Type first, so a reader sees the version before anything else (RF2).
internal sealed record PawnIoInfo(bool Installed, string? Version, bool? Loaded);

internal sealed record Hello
{
    public int V { get; init; } = Protocol.SchemaVersion;
    public string Type { get; init; } = "hello";
    public required bool Elevated { get; init; }
    public required PawnIoInfo PawnIo { get; init; }
}

internal sealed record HardwareInfo(string Id, string Name, string Type, string? Parent);

internal sealed record SensorInfo(string Id, string Hw, string Name, string Type, int Index, float? Value);

// Serial numbers are never sent (RF12 needs only size, type and configured speed).
internal sealed record MemoryModule(string Locator, double SizeGB, string Type, int? ConfiguredMTs);

internal sealed record Frame
{
    public int V { get; init; } = Protocol.SchemaVersion;
    public string Type { get; init; } = "frame";
    public required long Seq { get; init; }
    public required long T { get; init; }
    public required int PeriodMs { get; init; }
    public required MemoryModule[] Memory { get; init; }
    public required HardwareInfo[] Hardware { get; init; }
    public required SensorInfo[] Sensors { get; init; }
}

internal sealed record Ack
{
    public int V { get; init; } = Protocol.SchemaVersion;
    public string Type { get; init; } = "ack";
    public required int PeriodMs { get; init; }
}

internal sealed record ErrorMessage
{
    public int V { get; init; } = Protocol.SchemaVersion;
    public string Type { get; init; } = "error";
    public required string Code { get; init; }
    public required string Detail { get; init; }
}

// Nulls are written (DefaultIgnoreCondition.Never): frames never change shape.
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.Never)]
[JsonSerializable(typeof(Hello))]
[JsonSerializable(typeof(Frame))]
[JsonSerializable(typeof(Ack))]
[JsonSerializable(typeof(ErrorMessage))]
internal partial class HelperJson : JsonSerializerContext
{
}

/// <summary>JSON-lines writer. One lock covers every writer thread, so lines never interleave.</summary>
internal sealed class MessageWriter(Stream stream)
{
    readonly object _writeGate = new();
    readonly ArrayBufferWriter<byte> _buffer = new(4096);

    public void Send<T>(T message, JsonTypeInfo<T> info)
    {
        lock (_writeGate)
        {
            _buffer.ResetWrittenCount();
            using (var writer = new Utf8JsonWriter(_buffer))
            {
                JsonSerializer.Serialize(writer, message, info);
            }
            _buffer.Write("\n"u8);
            stream.Write(_buffer.WrittenSpan);
            stream.Flush();
        }
    }

    public void Reply(string code, string detail) =>
        Send(new ErrorMessage { Code = code, Detail = detail }, HelperJson.Default.ErrorMessage);
}
