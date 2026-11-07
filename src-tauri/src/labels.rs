use std::collections::BTreeMap;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

const FILE_NAME: &str = "labels.json";
const VERSION: u32 = 1;
const MAX_LABEL_UNITS: usize = 40;
const MAX_KEY_UNITS: usize = 512;

#[derive(Serialize, Deserialize)]
struct LabelFile {
    version: u32,
    labels: BTreeMap<String, String>,
}

#[derive(Serialize)]
pub struct LoadedLabels {
    pub labels: BTreeMap<String, String>,
    pub problem: Option<String>,
}

struct State {
    labels: BTreeMap<String, String>,
    problem: Option<String>,
    writable: bool,
}

pub struct LabelStore {
    path: PathBuf,
    state: Mutex<State>,
}

impl LabelStore {
    pub fn open(dir: &Path) -> LabelStore {
        let path = dir.join(FILE_NAME);
        let empty = |problem: Option<String>, writable: bool| State { labels: BTreeMap::new(), problem, writable };
        let state = match fs::read(&path) {
            Err(e) if e.kind() == ErrorKind::NotFound => empty(None, true),
            Err(e) => empty(Some(format!("could not read {}: {e}", path.display())), false),
            Ok(bytes) => match serde_json::from_slice::<LabelFile>(&bytes) {
                Ok(file) if file.version == VERSION => State { labels: file.labels, problem: None, writable: true },
                other => {
                    let reason = match other {
                        Ok(file) => format!("format version {} is not supported", file.version),
                        Err(e) => e.to_string(),
                    };
                    let bad = path.with_extension("json.bad");
                    match fs::rename(&path, &bad) {
                        Ok(()) => empty(
                            Some(format!("{} could not be used ({reason}); it was kept as {}", path.display(), bad.display())),
                            true,
                        ),
                        Err(e) => empty(
                            Some(format!("{} could not be used ({reason}) and could not be moved aside: {e}", path.display())),
                            false,
                        ),
                    }
                }
            },
        };
        LabelStore { path, state: Mutex::new(state) }
    }

    pub fn load(&self) -> LoadedLabels {
        let state = self.state.lock().unwrap();
        LoadedLabels { labels: state.labels.clone(), problem: state.problem.clone() }
    }

    pub fn set(&self, key: String, label: Option<String>) -> Result<(), String> {
        if key.is_empty() || key.encode_utf16().count() > MAX_KEY_UNITS {
            return Err("the sensor key is empty or too long".to_string());
        }
        if let Some(text) = &label {
            if text.is_empty() || text.trim() != text || text.encode_utf16().count() > MAX_LABEL_UNITS {
                return Err(format!("a name must be 1 to {MAX_LABEL_UNITS} characters, with no space at either end"));
            }
        }
        let mut state = self.state.lock().unwrap();
        if !state.writable {
            return Err(state.problem.clone().unwrap_or_default());
        }
        let mut file = LabelFile { version: VERSION, labels: state.labels.clone() };
        match label {
            Some(label) => file.labels.insert(key, label),
            None => file.labels.remove(&key),
        };
        self.write(&file)?;
        state.labels = file.labels;
        Ok(())
    }

    fn write(&self, file: &LabelFile) -> Result<(), String> {
        let tmp = self.path.with_extension("json.tmp");
        let text = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
        let written = (|| {
            {
                let mut out = fs::File::create(&tmp)?;
                out.write_all(text.as_bytes())?;
                out.sync_all()?;
            }
            fs::rename(&tmp, &self.path)
        })();
        written.map_err(|e| format!("could not write {}: {e}", self.path.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "/lpc/it8696e/0/fan/0|Fan #1";

    fn fresh_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pophood-labels-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn file_text(dir: &Path) -> String {
        fs::read_to_string(dir.join(FILE_NAME)).unwrap()
    }

    #[test]
    fn saves_and_reloads() {
        let dir = fresh_dir("saves_and_reloads");
        let store = LabelStore::open(&dir);
        assert!(store.load().labels.is_empty());
        assert!(store.load().problem.is_none());
        assert!(!dir.join(FILE_NAME).exists());

        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        let text = file_text(&dir);
        assert!(text.contains("\"version\": 1"));
        assert!(text.contains("\"CPU fan\""));
        assert!(!dir.join("labels.json.tmp").exists());

        let reopened = LabelStore::open(&dir).load();
        assert_eq!(reopened.labels.get(KEY).map(String::as_str), Some("CPU fan"));
        assert!(reopened.problem.is_none());
    }

    #[test]
    fn clears_a_label() {
        let dir = fresh_dir("clears_a_label");
        let store = LabelStore::open(&dir);
        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        store.set("other|Other".to_string(), Some("Other".to_string())).unwrap();
        store.set(KEY.to_string(), None).unwrap();

        assert!(!store.load().labels.contains_key(KEY));
        assert!(store.load().labels.contains_key("other|Other"));
        assert!(!file_text(&dir).contains("CPU fan"));
        assert!(file_text(&dir).contains("\"Other\""));
    }

    #[test]
    fn checks_key_and_label() {
        let dir = fresh_dir("checks_key_and_label");
        let store = LabelStore::open(&dir);
        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        let before = file_text(&dir);

        let long_key = "k".repeat(513);
        let too_long_label = "a".repeat(41);
        let too_long_emoji = "😀".repeat(21);
        let refused: Vec<(String, Option<String>)> = vec![
            (String::new(), Some("x".to_string())),
            (long_key, Some("x".to_string())),
            (KEY.to_string(), Some(String::new())),
            (KEY.to_string(), Some("   ".to_string())),
            (KEY.to_string(), Some(" CPU fan".to_string())),
            (KEY.to_string(), Some("CPU fan ".to_string())),
            (KEY.to_string(), Some(too_long_label)),
            (KEY.to_string(), Some(too_long_emoji)),
        ];
        for (key, label) in refused {
            assert!(store.set(key, label.clone()).is_err(), "{label:?} should be refused");
        }
        assert_eq!(file_text(&dir), before);
        assert_eq!(store.load().labels.get(KEY).map(String::as_str), Some("CPU fan"));

        store.set(KEY.to_string(), Some("a".repeat(40))).unwrap();
        store.set(KEY.to_string(), Some("😀".repeat(20))).unwrap();
        assert_eq!(store.load().labels.get(KEY), Some(&"😀".repeat(20)));
    }

    #[test]
    fn moves_a_bad_file_aside() {
        let dir = fresh_dir("moves_a_bad_file_aside");
        fs::write(dir.join(FILE_NAME), b"{").unwrap();
        let store = LabelStore::open(&dir);

        let loaded = store.load();
        assert!(loaded.labels.is_empty());
        assert!(loaded.problem.as_deref().unwrap().contains("labels.json.bad"));
        assert_eq!(fs::read(dir.join("labels.json.bad")).unwrap(), b"{");
        assert!(!dir.join(FILE_NAME).exists());

        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        let reopened = LabelStore::open(&dir).load();
        assert_eq!(reopened.labels.get(KEY).map(String::as_str), Some("CPU fan"));
        assert!(reopened.problem.is_none());
    }

    #[test]
    fn moves_a_non_utf8_file_aside() {
        let dir = fresh_dir("moves_a_non_utf8_file_aside");
        fs::write(dir.join(FILE_NAME), b"{\"version\":1,\"labels\":{\"k\":\"Gr\xfcn\"}}").unwrap();
        let store = LabelStore::open(&dir);

        assert!(store.load().problem.unwrap().contains("labels.json.bad"));
        assert!(dir.join("labels.json.bad").exists());
        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
    }

    #[test]
    fn moves_a_newer_version_aside() {
        let dir = fresh_dir("moves_a_newer_version_aside");
        fs::write(dir.join(FILE_NAME), br#"{"version":2,"labels":{}}"#).unwrap();
        let store = LabelStore::open(&dir);

        let problem = store.load().problem.unwrap();
        assert!(problem.contains("format version 2"));
        assert!(problem.contains("labels.json.bad"));
        assert_eq!(fs::read(dir.join("labels.json.bad")).unwrap(), br#"{"version":2,"labels":{}}"#);
        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        assert!(file_text(&dir).contains("\"version\": 1"));
    }

    #[test]
    fn never_overwrites_an_unreadable_file() {
        let dir = fresh_dir("never_overwrites_an_unreadable_file");
        fs::create_dir(dir.join(FILE_NAME)).unwrap();
        let store = LabelStore::open(&dir);

        let problem = store.load().problem.unwrap();
        assert!(problem.contains("could not read"));
        assert_eq!(store.set(KEY.to_string(), Some("CPU fan".to_string())), Err(problem));
        assert!(dir.join(FILE_NAME).is_dir());
        assert!(!dir.join("labels.json.bad").exists());
        assert!(store.load().labels.is_empty());
    }

    #[test]
    fn a_failed_write_changes_nothing() {
        let dir = fresh_dir("a_failed_write_changes_nothing");
        let store = LabelStore::open(&dir);
        store.set(KEY.to_string(), Some("CPU fan".to_string())).unwrap();
        let before = file_text(&dir);

        fs::create_dir(dir.join("labels.json.tmp")).unwrap();
        let error = store.set(KEY.to_string(), Some("Rear".to_string())).unwrap_err();
        assert!(error.starts_with("could not write "), "{error}");
        assert_eq!(store.load().labels.get(KEY).map(String::as_str), Some("CPU fan"));
        assert_eq!(file_text(&dir), before);
    }
}
