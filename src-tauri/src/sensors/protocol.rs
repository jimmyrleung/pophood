//! Pipe protocol, schema v1: one UTF-8 JSON object per line, every message carrying `"v": 1`.
//! Field names match the helper's `Protocol.cs` exactly; `sizeGB` and `configuredMTs` need explicit renames
//! because serde's camelCase would give `sizeGb` and `configuredMts`.

use std::fmt;

use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HelperMessage {
    Hello(Hello),
    Frame(Frame),
    Ack(Ack),
    Error(ErrorMessage),
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hello {
    pub v: u32,
    pub elevated: bool,
    pub pawn_io: PawnIo,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct PawnIo {
    pub installed: bool,
    pub version: Option<String>,
    /// `null` when the helper is unprivileged (not checked).
    pub loaded: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub v: u32,
    pub seq: u64,
    /// Unix ms (UTC) at the start of the tick that produced the frame.
    pub t: i64,
    pub period_ms: u32,
    pub memory: Vec<MemoryModule>,
    pub hardware: Vec<HardwareInfo>,
    pub sensors: Vec<SensorInfo>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct MemoryModule {
    pub locator: String,
    #[serde(rename = "sizeGB")]
    pub size_gb: f64,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "configuredMTs")]
    pub configured_mts: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct HardwareInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub parent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct SensorInfo {
    pub id: String,
    pub hw: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub index: i32,
    pub value: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ack {
    pub v: u32,
    pub period_ms: u32,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct ErrorMessage {
    pub v: u32,
    pub code: String,
    pub detail: String,
}

/// The only control message the helper accepts (#40).
#[derive(Debug, Clone, PartialEq)]
pub enum ControlMessage {
    SetPeriod { ms: u32 },
}

impl ControlMessage {
    pub fn set_period(ms: u32) -> Self {
        Self::SetPeriod { ms }
    }
}

impl Serialize for ControlMessage {
    // Written by hand so that `v` comes first on the wire, as in every other message.
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let Self::SetPeriod { ms } = self;
        let mut message = serializer.serialize_struct("ControlMessage", 3)?;
        message.serialize_field("v", &SCHEMA_VERSION)?;
        message.serialize_field("type", "set_period")?;
        message.serialize_field("ms", ms)?;
        message.end()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProtocolError {
    /// A line whose `v` is not 1. Reported even when the other fields no longer match.
    SchemaMismatch(u32),
    Malformed(String),
}

impl fmt::Display for ProtocolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SchemaMismatch(v) => write!(f, "schema version {v}, expected {SCHEMA_VERSION}"),
            Self::Malformed(why) => write!(f, "malformed line: {why}"),
        }
    }
}

impl std::error::Error for ProtocolError {}

#[derive(Deserialize)]
struct Envelope {
    v: u32,
}

/// Parses one helper line. The envelope is read first, so a version mismatch is reported even if the fields changed.
pub fn parse_line(line: &[u8]) -> Result<HelperMessage, ProtocolError> {
    let envelope: Envelope = serde_json::from_slice(line).map_err(|e| ProtocolError::Malformed(e.to_string()))?;
    if envelope.v != SCHEMA_VERSION {
        return Err(ProtocolError::SchemaMismatch(envelope.v));
    }
    serde_json::from_slice(line).map_err(|e| ProtocolError::Malformed(e.to_string()))
}

/// The key a sensor label will use (ADR 0008): the identifier plus the name, because `Identifier` alone is not unique
/// (`/gpu-nvidia/0/load/3` is shared by two sensors). Identifier parts are URI-escaped, so `|` can't occur in `id`.
pub fn sensor_key(id: &str, name: &str) -> String {
    format!("{id}|{name}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const HELLO: &str = r#"{"v":1,"type":"hello","elevated":false,"pawnIo":{"installed":true,"version":"2.2.0.0","loaded":null}}"#;
    const FRAME: &str = r#"{"v":1,"type":"frame","seq":42,"t":1761040800123,"periodMs":1000,
        "memory":[{"locator":"DIMM 1","sizeGB":16,"type":"DDR5","configuredMTs":6000}],
        "hardware":[{"id":"/amdcpu/0","name":"AMD Ryzen 9 9900X","type":"Cpu","parent":null}],
        "sensors":[{"id":"/amdcpu/0/temperature/2","hw":"/amdcpu/0","name":"Core (Tctl/Tdie)","type":"Temperature","index":2,"value":null},
                   {"id":"/amdcpu/0/load/0","hw":"/amdcpu/0","name":"CPU Total","type":"Load","index":0,"value":12.3}]}"#;

    // UT-07
    #[test]
    fn parses_hello() {
        let HelperMessage::Hello(hello) = parse_line(HELLO.as_bytes()).unwrap() else { panic!("not a hello") };
        assert!(!hello.elevated);
        assert!(hello.pawn_io.installed);
        assert_eq!(hello.pawn_io.version.as_deref(), Some("2.2.0.0"));
        assert_eq!(hello.pawn_io.loaded, None);
    }

    // UT-07: also proves the sizeGB / configuredMTs renames.
    #[test]
    fn parses_frame_with_memory_modules_and_null_values() {
        let HelperMessage::Frame(frame) = parse_line(FRAME.as_bytes()).unwrap() else { panic!("not a frame") };
        assert_eq!(frame.seq, 42);
        assert_eq!(frame.t, 1761040800123);
        assert_eq!(frame.period_ms, 1000);
        assert_eq!(frame.memory[0].size_gb, 16.0);
        assert_eq!(frame.memory[0].kind, "DDR5");
        assert_eq!(frame.memory[0].configured_mts, Some(6000));
        assert_eq!(frame.hardware[0].parent, None);
        assert_eq!(frame.sensors[0].value, None);
        assert_eq!(frame.sensors[1].value, Some(12.3));
    }

    // UT-07
    #[test]
    fn parses_ack_and_error() {
        let ack = parse_line(br#"{"v":1,"type":"ack","periodMs":250}"#).unwrap();
        assert_eq!(ack, HelperMessage::Ack(Ack { v: 1, period_ms: 250 }));
        let error = parse_line(br#"{"v":1,"type":"error","code":"out_of_range","detail":"ms must be 250..1000"}"#).unwrap();
        assert_eq!(
            error,
            HelperMessage::Error(ErrorMessage { v: 1, code: "out_of_range".into(), detail: "ms must be 250..1000".into() })
        );
    }

    // UT-07: the envelope is checked first.
    #[test]
    fn a_wrong_version_wins_over_unknown_content() {
        assert_eq!(parse_line(br#"{"v":2,"type":"x","junk":1}"#), Err(ProtocolError::SchemaMismatch(2)));
        assert_eq!(parse_line(br#"{"v":0}"#), Err(ProtocolError::SchemaMismatch(0)));
    }

    // UT-07
    #[test]
    fn bad_envelopes_are_malformed() {
        for line in [
            &br#"{"v":"1","type":"ack","periodMs":250}"#[..],
            br#"{"type":"ack","periodMs":250}"#,
            b"not json",
            b"",
            b"[1]",
            br#"{"v":-1}"#,
            br#"{"v":1.5}"#,
        ] {
            assert!(matches!(parse_line(line), Err(ProtocolError::Malformed(_))), "{}", String::from_utf8_lossy(line));
        }
    }

    #[test]
    fn a_known_version_with_an_unknown_type_is_malformed() {
        assert!(matches!(parse_line(br#"{"v":1,"type":"reboot"}"#), Err(ProtocolError::Malformed(_))));
    }

    #[test]
    fn set_period_serializes_to_the_wire_format() {
        assert_eq!(
            serde_json::to_string(&ControlMessage::set_period(250)).unwrap(),
            r#"{"v":1,"type":"set_period","ms":250}"#
        );
    }

    // UT-08
    #[test]
    fn sensor_key_joins_id_and_name() {
        assert_eq!(sensor_key("/amdcpu/0/load/0", "CPU Total"), "/amdcpu/0/load/0|CPU Total");
    }

    // UT-08: the one duplicate Identifier in the P1 dumps
    #[test]
    fn sensor_key_disambiguates_a_shared_identifier() {
        let bus = sensor_key("/gpu-nvidia/0/load/3", "GPU Bus");
        let memory = sensor_key("/gpu-nvidia/0/load/3", "GPU Memory");
        assert_ne!(bus, memory);
        assert_eq!(bus, "/gpu-nvidia/0/load/3|GPU Bus");
    }
}
