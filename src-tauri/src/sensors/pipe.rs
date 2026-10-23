//! The app's end of the helper pipe: the per-launch name, a connect that verifies who answered, and bounded line I/O.

use std::fmt;
use std::io;
use std::os::windows::io::AsRawHandle;
use std::time::{Duration, Instant};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, ReadHalf, WriteHalf};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::System::Pipes::GetNamedPipeServerProcessId;

use super::helper::HelperProcess;
use super::protocol::{ControlMessage, HelperMessage, ProtocolError, parse_line};

/// Longest helper line the app accepts (a full frame is ~30 KB).
pub const MAX_LINE: usize = 4 * 1024 * 1024;
const RETRY: Duration = Duration::from_millis(50);
const ERROR_FILE_NOT_FOUND: i32 = 2;
const ERROR_ACCESS_DENIED: i32 = 5;
const ERROR_PIPE_BUSY: i32 = 231;
/// The helper's exit code when its pipe name is already taken (`FirstPipeInstance` failed).
const HELPER_EXIT_PIPE_TAKEN: u32 = 3;

#[derive(Debug)]
pub enum PipeError {
    /// The helper didn't open the pipe before the deadline.
    Timeout,
    /// The helper exited before the pipe connected.
    ChildExited(u32),
    /// Another process holds the pipe: it answered with a server PID that isn't the one we launched, it denied us
    /// access (our helper's DACL always grants the current user), or it took the name first (the helper exited 3).
    /// The name is 128 random bits per launch, so none of these happens by accident. Nothing was written to it.
    Squatter { detail: String },
    /// The pipe closed (EOF).
    Closed,
    LineTooLong,
    Protocol(ProtocolError),
    Io(io::Error),
}

impl fmt::Display for PipeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Timeout => write!(f, "the helper did not open its pipe in time"),
            Self::ChildExited(code) => write!(f, "exit code {code}"),
            Self::Squatter { detail } => write!(f, "pipe squatter: {detail}"),
            Self::Closed => write!(f, "pipe closed"),
            Self::LineTooLong => write!(f, "helper line over {MAX_LINE} bytes"),
            Self::Protocol(e) => write!(f, "{e}"),
            Self::Io(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for PipeError {}

impl From<io::Error> for PipeError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

/// `pophood-` + 32 lowercase hex characters (128 random bits).
pub fn new_pipe_name() -> String {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).expect("the OS random generator is available");
    let mut name = String::from("pophood-");
    for byte in bytes {
        name.push_str(&format!("{byte:02x}"));
    }
    name
}

/// Connects to `\\.\pipe\{name}`, retrying every 50 ms while the pipe doesn't exist yet or is busy.
/// Gives up as soon as the child has exited. Then requires the server process to be the child we launched.
pub async fn connect_verified(
    name: &str,
    child: &HelperProcess,
    deadline: Instant,
) -> Result<HelperConnection, PipeError> {
    let path = format!(r"\\.\pipe\{name}");
    let client = loop {
        if let Some(code) = child.exit_code() {
            if code == HELPER_EXIT_PIPE_TAKEN {
                return Err(PipeError::Squatter { detail: "the helper found its pipe name taken".into() });
            }
            return Err(PipeError::ChildExited(code));
        }
        // tokio's default security QoS is SECURITY_IDENTIFICATION: a fake server can't impersonate us.
        match ClientOptions::new().read(true).write(true).open(&path) {
            Ok(client) => break client,
            Err(e) if matches!(e.raw_os_error(), Some(ERROR_FILE_NOT_FOUND | ERROR_PIPE_BUSY)) => {
                if Instant::now() >= deadline {
                    return Err(PipeError::Timeout);
                }
                tokio::time::sleep(RETRY).await;
            }
            Err(e) if e.raw_os_error() == Some(ERROR_ACCESS_DENIED) => {
                return Err(PipeError::Squatter { detail: "the pipe denied access".into() });
            }
            Err(e) => return Err(PipeError::Io(e)),
        }
    };

    let server_pid = server_process_id(&client)?;
    if server_pid != child.pid {
        // Dropped without a single write.
        return Err(PipeError::Squatter { detail: format!("process {server_pid}") });
    }
    Ok(HelperConnection::from_client(client))
}

fn server_process_id(client: &NamedPipeClient) -> Result<u32, PipeError> {
    let mut pid = 0u32;
    // SAFETY: the handle belongs to `client`, which is alive for the call.
    unsafe { GetNamedPipeServerProcessId(HANDLE(client.as_raw_handle()), &mut pid) }
        .map_err(|e| PipeError::Io(io::Error::other(e.to_string())))?;
    Ok(pid)
}

pub struct HelperConnection {
    reader: BufReader<ReadHalf<NamedPipeClient>>,
    writer: WriteHalf<NamedPipeClient>,
    line: Vec<u8>,
}

impl HelperConnection {
    /// Wraps a client that has already been verified (or, in tests, a fake server's client).
    pub fn from_client(client: NamedPipeClient) -> Self {
        let (reader, writer) = tokio::io::split(client);
        Self { reader: BufReader::new(reader), writer, line: Vec::new() }
    }

    /// Reads and parses the next line. A line over [`MAX_LINE`] fails with `LineTooLong`; the connection is then unusable.
    pub async fn next_message(&mut self) -> Result<HelperMessage, PipeError> {
        self.read_line().await?;
        parse_line(&self.line).map_err(PipeError::Protocol)
    }

    pub async fn send(&mut self, message: &ControlMessage) -> io::Result<()> {
        let mut bytes = serde_json::to_vec(message).map_err(io::Error::other)?;
        bytes.push(b'\n');
        self.writer.write_all(&bytes).await?;
        self.writer.flush().await
    }

    /// Writes bytes followed by a newline, without validating them. For the fuzz tests.
    pub async fn send_raw(&mut self, bytes: &[u8]) -> io::Result<()> {
        self.writer.write_all(bytes).await?;
        self.writer.write_all(b"\n").await?;
        self.writer.flush().await
    }

    async fn read_line(&mut self) -> Result<(), PipeError> {
        self.line.clear();
        loop {
            let available = self.reader.fill_buf().await?;
            if available.is_empty() {
                return Err(PipeError::Closed);
            }
            match available.iter().position(|&b| b == b'\n') {
                Some(end) => {
                    if self.line.len() + end > MAX_LINE {
                        return Err(PipeError::LineTooLong);
                    }
                    self.line.extend_from_slice(&available[..end]);
                    self.reader.consume(end + 1);
                    return Ok(());
                }
                None => {
                    let n = available.len();
                    if self.line.len() + n > MAX_LINE {
                        return Err(PipeError::LineTooLong);
                    }
                    self.line.extend_from_slice(available);
                    self.reader.consume(n);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    // UT-11
    #[test]
    fn pipe_name_has_the_documented_shape() {
        let name = new_pipe_name();
        assert_eq!(name.len(), "pophood-".len() + 32);
        let hex = name.strip_prefix("pophood-").expect("prefix");
        assert!(hex.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')), "{name}");
    }

    // UT-11
    #[test]
    fn a_thousand_pipe_names_are_distinct() {
        let names: HashSet<String> = (0..1000).map(|_| new_pipe_name()).collect();
        assert_eq!(names.len(), 1000);
    }
}
