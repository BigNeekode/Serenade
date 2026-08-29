//! Managed Hand installer provider.
//!
//! Implements the ToolInstaller boundary from quick-setup-architecture.md §7
//! for the verified Hand 0.6.x Windows release asset.
//!
//! Safety:
//! - only downloads from the backend allow-listed GitHub release URL;
//! - pins to a qualified release tag;
//! - verifies the SHA-256 checksum from the official checksums.txt;
//! - stages to a temporary directory and validates the binary before activation;
//! - never overwrites a system or custom binary;
//! - does not modify global PATH.

use crate::error::{Code, SerenadeError};
use crate::hand::compatibility;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// Qualified Hand release metadata. This is the compatibility manifest from
/// architecture.md §6 encoded as code for the Windows MVP.
pub struct HandRelease {
    pub tag: &'static str,
    pub version: &'static str,
    pub asset_name: &'static str,
    pub checksum: &'static str,
}

pub const QUALIFIED_HAND: HandRelease = HandRelease {
    tag: "v0.6.0",
    version: "0.6.0",
    asset_name: "hand-windows-amd64.zip",
    checksum: "ee0e99dfbc7547b59fb0a8fcd104ea02d88c1281da78f0ad30342f40dc383e0e",
};

const BASE_URL: &str = "https://github.com/atqamz/hand/releases/download";

fn release_url(tag: &str, asset: &str) -> String {
    format!("{}/{}/{}", BASE_URL, tag, asset)
}

fn checksums_url(tag: &str) -> String {
    format!("{}/{}/checksums.txt", BASE_URL, tag)
}

pub struct InstallPlan {
    pub tag: String,
    pub version: String,
    pub download_url: String,
    pub expected_checksum: String,
}

pub struct InstallResult {
    pub version: String,
    pub path: PathBuf,
}

/// Build a plan for installing the qualified Hand version.
pub fn plan_install() -> Result<InstallPlan, SerenadeError> {
    Ok(InstallPlan {
        tag: QUALIFIED_HAND.tag.to_string(),
        version: QUALIFIED_HAND.version.to_string(),
        download_url: release_url(QUALIFIED_HAND.tag, QUALIFIED_HAND.asset_name),
        expected_checksum: QUALIFIED_HAND.checksum.to_string(),
    })
}

/// Download a URL to a local path with size/time limits.
async fn download_to(url: &str, dest: &Path, max_size: usize) -> Result<(), SerenadeError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not create HTTP client", e.to_string()))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Download failed", e.to_string()))?;

    if !response.status().is_success() {
        return Err(SerenadeError::new(
            Code::DownloadFailed,
            "Download failed",
            format!("{} returned {}", url, response.status()),
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not read download", e.to_string()))?;

    if bytes.len() > max_size {
        return Err(SerenadeError::new(
            Code::DownloadFailed,
            "Download too large",
            format!("Asset is {} bytes; maximum allowed is {} bytes.", bytes.len(), max_size),
        ));
    }

    let mut file = std::fs::File::create(dest).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not write staged download", e.to_string())
    })?;
    file.write_all(&bytes)
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not write staged download", e.to_string()))?;
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, SerenadeError> {
    let mut file = std::fs::File::open(path).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not open file for hashing", e.to_string())
    })?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| {
            SerenadeError::new(Code::CommandFailed, "Could not read file for hashing", e.to_string())
        })?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Verify the downloaded archive against the expected checksum. For defense in
/// depth we also fetch the published checksums.txt and confirm the entry matches.
async fn verify_archive(archive: &Path, plan: &InstallPlan) -> Result<(), SerenadeError> {
    let got = sha256_file(archive)?;
    if got != plan.expected_checksum {
        return Err(SerenadeError::new(
            Code::IntegrityCheckFailed,
            "Checksum mismatch",
            format!("Expected {} but got {}.", plan.expected_checksum, got),
        )
        .with_action("The downloaded asset may have been corrupted or tampered with; try again."));
    }

    // Cross-check against the published checksums.txt.
    let checksums = download_checksums(&plan.tag).await?;
    let expected = checksums
        .lines()
        .find_map(|line| {
            let mut parts = line.split_whitespace();
            let hash = parts.next()?;
            let name = parts.next()?;
            if name == QUALIFIED_HAND.asset_name {
                Some(hash.to_lowercase())
            } else {
                None
            }
        })
        .ok_or_else(|| {
            SerenadeError::new(
                Code::IntegrityCheckFailed,
                "Could not verify checksum",
                "checksums.txt does not contain the expected asset.",
            )
        })?;

    if got != expected {
        return Err(SerenadeError::new(
            Code::IntegrityCheckFailed,
            "Checksum mismatch against published checksums.txt",
            format!("Expected {} but got {}.", expected, got),
        ));
    }

    Ok(())
}

async fn download_checksums(tag: &str) -> Result<String, SerenadeError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not create HTTP client", e.to_string()))?;

    let response = client
        .get(checksums_url(tag))
        .send()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not download checksums", e.to_string()))?;

    if !response.status().is_success() {
        return Err(SerenadeError::new(
            Code::DownloadFailed,
            "Could not download checksums",
            format!("checksums.txt returned {}", response.status()),
        ));
    }

    response
        .text()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not read checksums", e.to_string()))
}

fn extract_zip(archive: &Path, dest: &Path) -> Result<PathBuf, SerenadeError> {
    let file = std::fs::File::open(archive).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not open archive", e.to_string())
    })?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not read archive", e.to_string()))?;

    let mut extracted: Option<PathBuf> = None;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| {
            SerenadeError::new(Code::InstallFailed, "Could not read archive entry", e.to_string())
        })?;
        let name = entry.name();
        // Expect a single hand.exe inside the zip.
        if name.ends_with("hand.exe") || name == "hand" {
            let out_path = dest.join("hand.exe");
            let mut out_file = std::fs::File::create(&out_path).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not create extracted file", e.to_string())
            })?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not extract file", e.to_string())
            })?;
            extracted = Some(out_path);
        }
    }

    extracted.ok_or_else(|| {
        SerenadeError::new(
            Code::InstallFailed,
            "Archive did not contain hand executable",
            "The release asset may have an unexpected layout.",
        )
    })
}

fn probe_version(binary: &Path) -> Result<String, SerenadeError> {
    let output = std::process::Command::new(binary)
        .arg("--version")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not probe installed hand", e.to_string()))?;

    if !output.status.success() {
        return Err(SerenadeError::new(
            Code::InstallFailed,
            "Installed hand failed version probe",
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let compatibility = compatibility::classify(&stdout);
    if !compatibility.mutations_allowed {
        return Err(SerenadeError::new(
            Code::ToolIncompatible,
            "Installed Hand is not mutation-compatible",
            compatibility.reason,
        ));
    }
    Ok(stdout)
}

/// Install the qualified Hand version into the managed tools root.
/// Returns the absolute path to the activated hand.exe.
pub async fn install_managed_hand(managed_root: &Path) -> Result<InstallResult, SerenadeError> {
    if std::env::consts::OS != "windows" {
        return Err(SerenadeError::new(
            Code::UnsupportedPlatform,
            "Managed Hand installation is Windows-only in this MVP",
            "Use system or custom Hand on this platform.",
        ));
    }

    let plan = plan_install()?;

    let version_dir = managed_root.join("tools").join("hand").join(&plan.version);
    let staging = managed_root.join("cache").join(format!("hand-{}-staging", plan.version));

    std::fs::create_dir_all(&version_dir).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not create managed tool directory", e.to_string())
    })?;
    std::fs::create_dir_all(&staging).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not create staging directory", e.to_string())
    })?;

    let archive = staging.join(QUALIFIED_HAND.asset_name);

    // Clean up any partial staging from a previous failed attempt.
    let _ = std::fs::remove_file(&archive);

    download_to(&plan.download_url, &archive, 50_000_000).await?;

    verify_archive(&archive, &plan).await?;

    let extracted = extract_zip(&archive, &staging)?;

    let activated = version_dir.join("hand.exe");

    // Validate before activation.
    let version = probe_version(&extracted)?;

    // Atomic rename-style activation.
    std::fs::rename(&extracted, &activated).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not activate managed Hand", e.to_string())
    })?;

    // Clean up staging.
    let _ = std::fs::remove_dir_all(&staging);
    let _ = std::fs::remove_file(&archive);

    Ok(InstallResult { version, path: activated })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_uses_qualified_release() {
        let plan = plan_install().unwrap();
        assert_eq!(plan.tag, "v0.6.0");
        assert_eq!(plan.version, "0.6.0");
        assert!(plan.download_url.contains("hand-windows-amd64.zip"));
        assert!(!plan.expected_checksum.is_empty());
    }

    #[test]
    fn sha256_computes_expected_hash_for_known_string() {
        let tmp = std::env::temp_dir().join(format!("serenade-sha-test-{}", std::process::id()));
        std::fs::write(&tmp, b"hello").unwrap();
        let got = sha256_file(&tmp).unwrap();
        // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        assert_eq!(got, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        let _ = std::fs::remove_file(&tmp);
    }

    #[test]
    fn non_windows_install_fails_closed() {
        if std::env::consts::OS == "windows" {
            return;
        }
        let tmp = std::env::temp_dir().join(format!("serenade-install-test-{}", std::process::id()));
        let result = std::thread::Builder::new()
            .spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(install_managed_hand(&tmp))
            })
            .unwrap()
            .join()
            .unwrap();
        assert!(result.is_err());
    }
}
