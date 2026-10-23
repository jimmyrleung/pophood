//! The UI contract (core → UI): what the supervisor sends over the Channel. The TypeScript mirror is
//! `src/sensors/protocol.ts`; the shared fixture `src/test/fixtures/event-frame.json` locks both (UT-28).

use serde::Serialize;

use super::protocol::{Frame, HardwareInfo, MemoryModule, PawnIo, sensor_key};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Starting,
    Live,
    Reconnecting,
    Stopped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Elevation {
    Idle,
    Prompting,
    Connecting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NoticeCode {
    // Integrity and security: always blocking, wherever they're detected.
    HelperMissing,
    HelperHashMismatch,
    PipeSquatter,
    SchemaMismatch,
    // Blocking only after three restart attempts.
    HelperError,
    HelperExited,
    // Not blocking.
    FullSensorsLost,
    UacCancelled,
    ElevationFailed,
    ElevationTimeout,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Notice {
    pub code: NoticeCode,
    pub detail: Option<String>,
}

impl Notice {
    pub fn new(code: NoticeCode, detail: impl Into<Option<String>>) -> Self {
        Self { code, detail: detail.into() }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorStatus {
    pub phase: Phase,
    /// From the current connection's hello; `None` before the first one.
    pub elevated: Option<bool>,
    pub pawn_io: Option<PawnIo>,
    pub elevation: Elevation,
    pub notice: Option<Notice>,
    /// 1..=3 while reconnecting.
    pub restart_attempt: Option<u32>,
    pub helper_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct UiSensor {
    pub id: String,
    pub hw: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub index: i32,
    pub value: Option<f64>,
    /// `id|name`, the stable key labels and history use (ADR 0008).
    pub key: String,
}

/// A helper `Frame` minus `v`/`type`, plus `elevated`, with a `key` on each sensor.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiFrame {
    pub seq: u64,
    pub t: i64,
    pub period_ms: u32,
    pub elevated: bool,
    pub memory: Vec<MemoryModule>,
    pub hardware: Vec<HardwareInfo>,
    pub sensors: Vec<UiSensor>,
}

impl UiFrame {
    pub fn from_frame(frame: Frame, elevated: bool) -> Self {
        Self {
            seq: frame.seq,
            t: frame.t,
            period_ms: frame.period_ms,
            elevated,
            memory: frame.memory,
            hardware: frame.hardware,
            sensors: frame
                .sensors
                .into_iter()
                .map(|s| UiSensor {
                    key: sensor_key(&s.id, &s.name),
                    id: s.id,
                    hw: s.hw,
                    name: s.name,
                    kind: s.kind,
                    index: s.index,
                    value: s.value,
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SensorEvent {
    Status { status: SensorStatus },
    Frame { frame: UiFrame },
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensors::protocol::{Frame as HelperFrame, SensorInfo};

    fn sample_frame() -> SensorEvent {
        let helper_frame = HelperFrame {
            v: 1,
            seq: 7,
            t: 1761040800123,
            period_ms: 1000,
            memory: vec![MemoryModule {
                locator: "DIMM 1".into(),
                size_gb: 16.0,
                kind: "DDR5".into(),
                configured_mts: Some(6000),
            }],
            hardware: vec![HardwareInfo {
                id: "/amdcpu/0".into(),
                name: "AMD Ryzen 9 9900X".into(),
                kind: "Cpu".into(),
                parent: None,
            }],
            sensors: vec![
                SensorInfo {
                    id: "/amdcpu/0/temperature/2".into(),
                    hw: "/amdcpu/0".into(),
                    name: "Core (Tctl/Tdie)".into(),
                    kind: "Temperature".into(),
                    index: 2,
                    value: None,
                },
                SensorInfo {
                    id: "/amdcpu/0/load/0".into(),
                    hw: "/amdcpu/0".into(),
                    name: "CPU Total".into(),
                    kind: "Load".into(),
                    index: 0,
                    value: Some(12.3),
                },
            ],
        };
        SensorEvent::Frame { frame: UiFrame::from_frame(helper_frame, false) }
    }

    // UT-28, Rust half: the TypeScript half parses the very same file.
    #[test]
    fn a_frame_event_serialises_to_the_shared_fixture() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../src/test/fixtures/event-frame.json")).expect("fixture is JSON");
        assert_eq!(serde_json::to_value(sample_frame()).unwrap(), fixture);
    }

    #[test]
    fn a_status_event_uses_the_documented_names() {
        let status = SensorStatus {
            phase: Phase::Live,
            elevated: Some(false),
            pawn_io: Some(PawnIo { installed: true, version: Some("2.2.0.0".into()), loaded: None }),
            elevation: Elevation::Connecting,
            notice: None,
            restart_attempt: None,
            helper_sha256: "71c0".into(),
        };
        let json = serde_json::to_value(SensorEvent::Status { status }).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "kind": "status",
                "status": {
                    "phase": "live", "elevated": false,
                    "pawnIo": {"installed": true, "version": "2.2.0.0", "loaded": null},
                    "elevation": "connecting", "notice": null, "restartAttempt": null, "helperSha256": "71c0"
                }
            })
        );
    }

    #[test]
    fn a_stopped_status_carries_the_blocking_notice() {
        let status = SensorStatus {
            phase: Phase::Stopped,
            elevated: None,
            pawn_io: None,
            elevation: Elevation::Idle,
            notice: Some(Notice::new(NoticeCode::HelperHashMismatch, "expected 71c0, got 03ab".to_string())),
            restart_attempt: None,
            helper_sha256: "71c0".into(),
        };
        let json = serde_json::to_value(SensorEvent::Status { status }).unwrap();
        assert_eq!(json["status"]["phase"], "stopped");
        assert_eq!(json["status"]["notice"], serde_json::json!({"code": "helper_hash_mismatch", "detail": "expected 71c0, got 03ab"}));
        assert_eq!(json["status"]["elevated"], serde_json::Value::Null);
    }

    #[test]
    fn every_notice_code_serialises_in_snake_case() {
        let codes = [
            (NoticeCode::HelperMissing, "helper_missing"),
            (NoticeCode::HelperHashMismatch, "helper_hash_mismatch"),
            (NoticeCode::PipeSquatter, "pipe_squatter"),
            (NoticeCode::SchemaMismatch, "schema_mismatch"),
            (NoticeCode::HelperError, "helper_error"),
            (NoticeCode::HelperExited, "helper_exited"),
            (NoticeCode::FullSensorsLost, "full_sensors_lost"),
            (NoticeCode::UacCancelled, "uac_cancelled"),
            (NoticeCode::ElevationFailed, "elevation_failed"),
            (NoticeCode::ElevationTimeout, "elevation_timeout"),
        ];
        for (code, text) in codes {
            assert_eq!(serde_json::to_value(code).unwrap(), serde_json::json!(text));
        }
    }
}
