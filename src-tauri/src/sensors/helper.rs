//! The helper's image and process: hash-and-hold, unprivileged and elevated launch, wait and terminate.
//!
//! The hash is checked through a handle opened with `FILE_SHARE_READ` only, and that handle stays open until the
//! launch, so the file can't be renamed, overwritten or deleted between the check and the start (C11 narrowing).
//! This does not stop a DLL planted next to the helper: the helper restricts its own DLL search to System32.

use std::fmt;
use std::fs::{File, OpenOptions};
use std::io::{self, Read};
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use sha2::{Digest, Sha256};
use windows::Win32::Foundation::{ERROR_CANCELLED, HANDLE, HWND, WAIT_OBJECT_0};
use windows::Win32::Storage::FileSystem::FILE_SHARE_READ;
use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize};
use windows::Win32::System::Threading::{
    GetExitCodeProcess, GetProcessId, TerminateProcess, WaitForMultipleObjects,
};
use windows::Win32::UI::Shell::{SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW, ShellExecuteExW};
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
use windows::core::{HSTRING, PCWSTR};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
/// `GetExitCodeProcess` reports this while the process is running.
const STILL_ACTIVE: u32 = 259;

#[derive(Debug)]
pub enum ImageError {
    /// No file at the helper's path.
    Missing(PathBuf),
    /// The file's SHA-256 is not the one compiled into this build.
    HashMismatch { actual: String },
    Io(io::Error),
}

impl fmt::Display for ImageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing(path) => write!(f, "{}", path.display()),
            Self::HashMismatch { actual } => write!(f, "got {actual}"),
            Self::Io(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for ImageError {}

/// The helper exe, verified and held open with `FILE_SHARE_READ` only (deny write and delete).
pub struct HelperImage {
    // Held for its sharing mode; never read again.
    _file: File,
    path: PathBuf,
}

impl HelperImage {
    pub fn open_verified(path: &Path, sha256_hex: &str) -> Result<Self, ImageError> {
        let mut file = match OpenOptions::new().read(true).share_mode(FILE_SHARE_READ.0).open(path) {
            Ok(file) => file,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Err(ImageError::Missing(path.to_path_buf())),
            Err(e) => return Err(ImageError::Io(e)),
        };
        let mut hasher = Sha256::new();
        let mut buffer = vec![0u8; 64 * 1024];
        loop {
            let n = file.read(&mut buffer).map_err(ImageError::Io)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        let actual = format!("{:x}", hasher.finalize());
        if !actual.eq_ignore_ascii_case(sha256_hex) {
            return Err(ImageError::HashMismatch { actual });
        }
        Ok(Self { _file: file, path: path.to_path_buf() })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

/// A launched helper. The process handle is owned, so the PID can't be reused while we hold it.
pub struct HelperProcess {
    handle: OwnedHandle,
    pub pid: u32,
}

impl HelperProcess {
    fn raw(&self) -> HANDLE {
        HANDLE(self.handle.as_raw_handle())
    }

    /// `None` while the process is running.
    pub fn exit_code(&self) -> Option<u32> {
        let mut code = 0u32;
        // SAFETY: the handle is valid for the lifetime of `self`.
        unsafe { GetExitCodeProcess(self.raw(), &mut code) }.ok()?;
        (code != STILL_ACTIVE).then_some(code)
    }

    pub fn terminate(&self) {
        // SAFETY: the handle is valid for the lifetime of `self`. A process that already exited is not an error here.
        let _ = unsafe { TerminateProcess(self.raw(), 1) };
    }
}

/// Starts the helper with no window and no stdio. `client` is the path the helper will require of its client.
pub fn launch_unprivileged(img: &HelperImage, pipe: &str, client: &Path) -> io::Result<HelperProcess> {
    let child = Command::new(img.path())
        .arg("--pipe")
        .arg(pipe)
        .arg("--client")
        .arg(client)
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let pid = child.id();
    Ok(HelperProcess { handle: OwnedHandle::from(child), pid })
}

#[derive(Debug)]
pub enum ElevateError {
    /// The user declined the UAC prompt.
    Cancelled,
    Failed(String),
}

impl fmt::Display for ElevateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Cancelled => write!(f, "cancelled"),
            Self::Failed(why) => write!(f, "{why}"),
        }
    }
}

impl std::error::Error for ElevateError {}

/// Starts the helper through `ShellExecuteExW("runas")` and returns its process handle. Blocks until the UAC prompt is
/// answered, so call it from a blocking thread. `owner` is the HWND of the main window (as `isize`, since `HWND` isn't
/// `Send`), so the consent prompt opens in the foreground.
pub fn launch_elevated(
    img: &HelperImage,
    pipe: &str,
    client: &Path,
    owner: isize,
) -> Result<HelperProcess, ElevateError> {
    let file = HSTRING::from(img.path().as_os_str());
    let parameters = HSTRING::from(format!("--pipe {pipe} --client \"{}\"", client.display()));

    // ShellExecuteEx wants COM initialised as a single-threaded apartment on the calling thread, so it gets a
    // thread of its own rather than borrowing one from a pool.
    std::thread::scope(|scope| {
        scope
            .spawn(|| {
                // SAFETY: balanced with CoUninitialize below when it succeeded; every pointer in `info` outlives the call.
                unsafe {
                    let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
                    let mut info = SHELLEXECUTEINFOW {
                        cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
                        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
                        hwnd: HWND(owner as *mut core::ffi::c_void),
                        lpVerb: windows::core::w!("runas"),
                        lpFile: PCWSTR(file.as_ptr()),
                        lpParameters: PCWSTR(parameters.as_ptr()),
                        nShow: SW_HIDE.0,
                        ..Default::default()
                    };
                    let result = ShellExecuteExW(&mut info);
                    if com {
                        CoUninitialize();
                    }
                    match result {
                        Ok(()) if info.hProcess.is_invalid() => {
                            Err(ElevateError::Failed("no process handle was returned".into()))
                        }
                        Ok(()) => {
                            let pid = GetProcessId(info.hProcess);
                            let handle = OwnedHandle::from_raw_handle(info.hProcess.0);
                            Ok(HelperProcess { handle, pid })
                        }
                        Err(e) if e.code() == ERROR_CANCELLED.to_hresult() => Err(ElevateError::Cancelled),
                        Err(e) => Err(ElevateError::Failed(e.message())),
                    }
                }
            })
            .join()
            .unwrap_or_else(|_| Err(ElevateError::Failed("the elevation thread panicked".into())))
    })
}

/// Waits for every process to exit against one shared deadline. Returns false if any is still running.
pub fn wait_all(procs: &[&HelperProcess], timeout: Duration) -> bool {
    if procs.is_empty() {
        return true;
    }
    let handles: Vec<HANDLE> = procs.iter().map(|p| p.raw()).collect();
    let millis = u32::try_from(timeout.as_millis()).unwrap_or(u32::MAX - 1);
    // SAFETY: every handle stays valid while `procs` is borrowed.
    unsafe { WaitForMultipleObjects(&handles, true, millis) == WAIT_OBJECT_0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, contents: &[u8]) -> PathBuf {
        let path = std::env::temp_dir().join(format!("pophood-ut09-{}-{name}", std::process::id()));
        std::fs::File::create(&path).unwrap().write_all(contents).unwrap();
        path
    }

    fn sha(bytes: &[u8]) -> String {
        format!("{:x}", Sha256::digest(bytes))
    }

    // UT-09
    #[test]
    fn matching_hash_opens() {
        let path = temp_file("match.exe", b"helper bytes");
        let image = HelperImage::open_verified(&path, &sha(b"helper bytes")).unwrap();
        assert_eq!(image.path(), path);
        drop(image);
        std::fs::remove_file(path).unwrap();
    }

    // UT-09
    #[test]
    fn mismatching_hash_reports_the_actual_one() {
        let path = temp_file("mismatch.exe", b"helper bytes");
        match HelperImage::open_verified(&path, &sha(b"other bytes")) {
            Err(ImageError::HashMismatch { actual }) => assert_eq!(actual, sha(b"helper bytes")),
            other => panic!("expected a hash mismatch, got {:?}", other.map(|_| ())),
        }
        std::fs::remove_file(path).unwrap();
    }

    // UT-09
    #[test]
    fn missing_file_is_reported() {
        let path = std::env::temp_dir().join("pophood-ut09-does-not-exist.exe");
        assert!(matches!(HelperImage::open_verified(&path, &sha(b"x")), Err(ImageError::Missing(_))));
    }

    // UT-09: the hash comparison ignores case, the image path is returned as given.
    #[test]
    fn uppercase_expected_hash_matches() {
        let path = temp_file("upper.exe", b"abc");
        assert!(HelperImage::open_verified(&path, &sha(b"abc").to_uppercase()).is_ok());
        std::fs::remove_file(path).unwrap();
    }

    // UT-09: while the image is held, the file can be read and launched but not changed.
    #[test]
    fn held_image_cannot_be_renamed_overwritten_or_deleted() {
        let path = temp_file("held.exe", b"helper bytes");
        let image = HelperImage::open_verified(&path, &sha(b"helper bytes")).unwrap();

        let renamed = path.with_extension("renamed");
        let rename = std::fs::rename(&path, &renamed).unwrap_err();
        assert_eq!(rename.raw_os_error(), Some(32), "rename: {rename}"); // ERROR_SHARING_VIOLATION

        let overwrite = OpenOptions::new().write(true).open(&path).unwrap_err();
        assert_eq!(overwrite.raw_os_error(), Some(32), "overwrite: {overwrite}");

        let delete = std::fs::remove_file(&path).unwrap_err();
        assert_eq!(delete.raw_os_error(), Some(32), "delete: {delete}");

        // Reading is still allowed (a launcher maps the image with read sharing).
        assert!(OpenOptions::new().read(true).share_mode(FILE_SHARE_READ.0).open(&path).is_ok());

        drop(image);
        std::fs::remove_file(&path).unwrap();
    }
}
