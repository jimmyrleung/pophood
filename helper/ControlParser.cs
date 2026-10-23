using System.Text.Json;
using System.Text.Unicode;

namespace Pophood.Sensors;

internal abstract record ControlResult;
internal sealed record Accepted(int PeriodMs) : ControlResult;
internal sealed record Rejected(string Code, string Detail) : ControlResult;

/// <summary>
/// Validates one control line from the app (RF31). The only accepted message is <c>set_period</c> with ms in 250..1000.
/// Order: encoding, JSON (depth 2, no duplicate properties), object, field allow-list, version, type, range.
/// Never throws: the catch-all turns any exception into <c>internal_error</c>.
/// </summary>
internal static class ControlParser
{
    public const int MinPeriodMs = 250;
    public const int MaxPeriodMs = 1000;

    static readonly JsonDocumentOptions Options = new() { MaxDepth = 2, AllowDuplicateProperties = false };

    public static ControlResult Parse(ReadOnlySpan<byte> line)
    {
        try
        {
            if (line.Length > 0 && line[^1] == (byte)'\r') line = line[..^1];

            // JsonDocument validates UTF-8 lazily (invalid bytes inside a string throw later, from GetString),
            // so reject them first. This was the crash P2 found.
            if (!Utf8.IsValid(line)) return new Rejected("bad_encoding", "invalid UTF-8");

            JsonDocument doc;
            try { doc = JsonDocument.Parse(line.ToArray(), Options); }
            catch (JsonException e) { return new Rejected("bad_json", Trunc(e.Message)); }

            using (doc)
            {
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return new Rejected("not_object", root.ValueKind.ToString());

                int? v = null;
                string? type = null;
                JsonElement? msElement = null;
                foreach (var prop in root.EnumerateObject())
                {
                    switch (prop.Name)
                    {
                        case "v":
                            if (prop.Value.ValueKind != JsonValueKind.Number || !prop.Value.TryGetInt32(out var parsedV))
                                return new Rejected("bad_field", "v");
                            v = parsedV;
                            break;
                        case "type":
                            if (prop.Value.ValueKind != JsonValueKind.String) return new Rejected("bad_field", "type");
                            type = prop.Value.GetString();
                            break;
                        case "ms":
                            msElement = prop.Value;
                            break;
                        default:
                            return new Rejected("unknown_field", Trunc(prop.Name));
                    }
                }

                if (v != Protocol.SchemaVersion) return new Rejected("bad_version", v?.ToString() ?? "missing");
                if (type != "set_period") return new Rejected("unknown_type", Trunc(type ?? "missing"));

                if (msElement is not { ValueKind: JsonValueKind.Number } el || !el.TryGetInt32(out int ms))
                    return new Rejected("bad_field", "ms");
                if (ms < MinPeriodMs || ms > MaxPeriodMs)
                    return new Rejected("out_of_range", $"{ms} not in [{MinPeriodMs},{MaxPeriodMs}]");
                return new Accepted(ms);
            }
        }
        catch (Exception e)
        {
            return new Rejected("internal_error", e.GetType().Name);
        }
    }

    static string Trunc(string s) => s.Length <= 80 ? s : s[..80] + "...";
}
