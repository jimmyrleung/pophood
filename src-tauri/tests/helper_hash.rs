use sha2::{Digest, Sha256};
use std::path::PathBuf;

// UT-13: the hash compiled into pophood.exe equals the SHA-256 of the staged helper.
#[test]
fn compiled_in_hash_matches_the_staged_helper() {
    let compiled = env!("POPHOOD_HELPER_SHA256");
    assert_eq!(compiled.len(), 64);
    assert!(compiled.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')), "not lowercase hex: {compiled}");

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("pophood-sensors-x86_64-pc-windows-msvc.exe");
    let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));
    assert_eq!(compiled, format!("{:x}", Sha256::digest(&bytes)));
}
