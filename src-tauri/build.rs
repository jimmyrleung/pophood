use sha2::{Digest, Sha256};
use std::path::PathBuf;

fn main() {
    // The helper's SHA-256 is compiled into pophood.exe (RF14): the app refuses to start any other file.
    // It runs before tauri_build::build(), which exits on a missing sidecar with a less helpful message.
    let target = std::env::var("TARGET").expect("cargo sets TARGET");
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"));
    let helper = manifest_dir.join("binaries").join(format!("pophood-sensors-{target}.exe"));

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed={}", helper.display());

    let bytes = match std::fs::read(&helper) {
        Ok(bytes) => bytes,
        Err(e) => {
            eprintln!("error: cannot read the sensor helper at {}: {e}", helper.display());
            eprintln!("error: run `npm run build:helper` first.");
            std::process::exit(1);
        }
    };
    println!("cargo:rustc-env=POPHOOD_HELPER_SHA256={:x}", Sha256::digest(&bytes));

    tauri_build::build();
}
