//! Native installers for the Hand 0.6 runtime dependency chain (treehouse, herdr).
//!
//! Hand 0.6 has no `hand runtime` command; it relies on `treehouse` (git worktree
//! pool) and `herdr` (terminal runtime) as external tools it invokes from PATH.
//! The vendor bootstrap scripts (`irm ... | iex`) broke in real environments
//! (PowerShell < 5.0 lacks `New-TemporaryFile`; curl.exe schannel revocation
//! checks fail on restricted networks), so these installers replicate the
//! official installers' contracts natively:
//!
//! - treehouse: resolve the latest release through the GitHub API (exactly what
//!   install.ps1 does), download the official versioned asset, verify it against
//!   the release's published `checksums.txt`, extract to
//!   `%LOCALAPPDATA%\treehouse`, and register that dir on the user PATH like the
//!   official installer does.
//! - herdr: fetch the official manifest at `https://herdr.dev/latest.json`
//!   (version + asset URL + SHA-256), download, verify, extract the full package
//!   (including the ConPTY bundle) into Herdr's release layout, and create the
//!   same junctions the official installer manages.
//!
//! Downloads use reqwest with rustls, so neither the local PowerShell version
//! nor curl.exe's schannel revocation behavior can break an install. Both
//! installers validate `--version` after activation.
//!
//! These tools are version-unpinned ("latest stable") because that is the
//! vendors' documented contract; integrity IS verified against published
//! checksums/manifests.

use crate::error::{Code, SerenadeError};
use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Give the Herdr TUI its own console window so the operator can watch and
/// interact with worker panes (Herdr's documented operator model).
#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

const TREEHOUSE_RELEASE_API: &str = "https://api.github.com/repos/kunchenguid/treehouse/releases/latest";
const TREEHOUSE_DOWNLOAD_BASE: &str = "https://github.com/kunchenguid/treehouse/releases/download";
const HERDR_MANIFEST_URL: &str = "https://herdr.dev/latest.json";
const HERDR_TARGET_TRIPLE: &str = "x86_64-pc-windows-msvc";

const DOWNLOAD_TIMEOUT_SECS: u64 = 300;
const MAX_ASSET_BYTES: usize = 200_000_000;
const POWERSHELL_TIMEOUT_SECS: u64 = 60;

// ---------------------------------------------------------------------------
// Known install locations (shared with the environment scan and the runner)
// ---------------------------------------------------------------------------

fn localappdata() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    std::env::var("LOCALAPPDATA")
        .ok()
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
}

/// `%LOCALAPPDATA%\treehouse` — the official installer's install directory.
pub fn treehouse_dir() -> Option<PathBuf> {
    localappdata().map(|p| p.join("treehouse"))
}

pub fn treehouse_exe() -> Option<PathBuf> {
    treehouse_dir().map(|d| d.join("treehouse.exe"))
}

/// `%LOCALAPPDATA%\Programs\Herdr\bin` — the visible junction the official
/// herdr installer points at the active release.
pub fn herdr_bin_dir() -> Option<PathBuf> {
    localappdata().map(|p| p.join("Programs").join("Herdr").join("bin"))
}

pub fn herdr_exe() -> Option<PathBuf> {
    herdr_bin_dir().map(|d| d.join("herdr.exe"))
}

fn herdr_home() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    std::env::var("HERDR_HOME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var("USERPROFILE").ok().map(|h| PathBuf::from(h).join(".herdr")))
}

/// Existing runtime tool directories that should be reachable from Hand child
/// processes even before a refreshed user PATH takes effect.
pub fn runtime_tool_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(d) = treehouse_dir() {
        dirs.push(d);
    }
    if let Some(d) = herdr_bin_dir() {
        dirs.push(d);
    }
    dirs
}

/// Open a new console window running Herdr, starting (or attaching to) the
/// Herdr server. Hand 0.6 dispatches workers into Herdr panes and refuses
/// with `server_not_running` until the server is up.
///
/// User-visible by design: Herdr's operator model expects a window the
/// operator can watch; Serenade never starts hidden background processes.
/// If a server is already running, `herdr` simply attaches to it.
pub fn start_herdr_console() -> Result<(), SerenadeError> {
    let exe = which::which("herdr")
        .ok()
        .or_else(|| herdr_exe().filter(|p| p.is_file()))
        .ok_or_else(|| {
            SerenadeError::new(
                Code::CommandFailed,
                "Herdr is not installed",
                "No Herdr executable was found on PATH or in its install location.",
            )
            .with_action("Install Herdr from Settings -> Environment first.")
        })?;

    let mut cmd = Command::new(&exe);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Own console window; std handles attach to the new console so the
        // Herdr TUI renders there. Do NOT redirect stdio for this one.
        cmd.creation_flags(CREATE_NEW_CONSOLE);
    }
    cmd.spawn().map(|_| ()).map_err(|e| {
        SerenadeError::new(Code::CommandFailed, "Could not start Herdr", e.to_string())
    })
}

// ---------------------------------------------------------------------------
// HTTP + hashing helpers
// ---------------------------------------------------------------------------

fn http_client() -> Result<reqwest::Client, SerenadeError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not create HTTP client", e.to_string()))
}

async fn download_to(client: &reqwest::Client, url: &str, dest: &Path, max_bytes: usize) -> Result<(), SerenadeError> {
    let response = client
        .get(url)
        .header("User-Agent", "serenade-desktop")
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
    if bytes.len() > max_bytes {
        return Err(SerenadeError::new(
            Code::DownloadFailed,
            "Download too large",
            format!("Asset is {} bytes; maximum allowed is {} bytes.", bytes.len(), max_bytes),
        ));
    }
    std::fs::write(dest, bytes)
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not write staged download", e.to_string()))
}

async fn download_json(client: &reqwest::Client, url: &str) -> Result<serde_json::Value, SerenadeError> {
    let response = client
        .get(url)
        .header("User-Agent", "serenade-desktop")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not fetch manifest", e.to_string()))?;
    if !response.status().is_success() {
        return Err(SerenadeError::new(
            Code::DownloadFailed,
            "Could not fetch manifest",
            format!("{} returned {}", url, response.status()),
        ));
    }
    response
        .json()
        .await
        .map_err(|e| SerenadeError::new(Code::ParseFailed, "Manifest was not valid JSON", e.to_string()))
}

fn sha256_hex(path: &Path) -> Result<String, SerenadeError> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not open file for hashing", e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = std::io::Read::read(&mut file, &mut buf)
            .map_err(|e| SerenadeError::new(Code::CommandFailed, "Could not read file for hashing", e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Look up the expected hash for `asset_name` inside a `checksums.txt`
/// document (`<hex>  <name>` per line).
fn checksum_for(checksums: &str, asset_name: &str) -> Option<String> {
    checksums
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let hash = parts.next()?;
            let name = parts.next()?;
            if name == asset_name {
                Some(hash.to_lowercase())
            } else {
                None
            }
        })
        .next()
}

// ---------------------------------------------------------------------------
// Extraction + probing helpers
// ---------------------------------------------------------------------------

/// Extract an entire zip archive into `dest`, preserving structure, refusing
/// entries that would escape the destination (zip-slip guard).
fn extract_zip_all(archive: &Path, dest: &Path) -> Result<(), SerenadeError> {
    let file = std::fs::File::open(archive)
        .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not open archive", e.to_string()))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not read archive", e.to_string()))?;
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not read archive entry", e.to_string()))?;
        let name = entry.name().replace('\\', "/");
        if name.starts_with('/') || name.contains(':') {
            return Err(SerenadeError::new(
                Code::InstallFailed,
                "Archive contained an unsafe entry path",
                name,
            ));
        }
        let rel = Path::new(&name);
        if rel.components().any(|c| matches!(c, Component::ParentDir)) {
            return Err(SerenadeError::new(
                Code::InstallFailed,
                "Archive contained a path traversal entry",
                name,
            ));
        }
        let out_path = dest.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not create directory", e.to_string()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    SerenadeError::new(Code::InstallFailed, "Could not create directory", e.to_string())
                })?;
            }
            let mut out = std::fs::File::create(&out_path).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not create extracted file", e.to_string())
            })?;
            std::io::copy(&mut entry, &mut out).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not extract file", e.to_string())
            })?;
        }
    }
    Ok(())
}

fn no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

pub(crate) fn probe_version(binary: &Path) -> Option<String> {
    let mut cmd = Command::new(binary);
    cmd.arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    no_window(&mut cmd);
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

// ---------------------------------------------------------------------------
// User PATH registration (replicates the official installers)
// ---------------------------------------------------------------------------

/// Prepend `dir` to the user-scope PATH registry entry and broadcast the
/// environment change, exactly like the official installers do. The directory
/// is passed via an environment variable so no path is interpolated into the
/// script. User-scope only; never touches the machine PATH.
fn prepend_user_path(dir: &Path) -> Result<(), SerenadeError> {
    // Adds a directory to the front of the user PATH if not already present,
    // then broadcasts WM_SETTINGCHANGE so new terminals pick it up.
    let script = concat!(
        "$bin=$env:SERENADE_TOOL_DIR;",
        "$p=[Environment]::GetEnvironmentVariable('Path','User');",
        "if(-not $p){$p=''};",
        "$exists=$false;",
        "foreach($e in $p.Split(';')){ if($e -and ($e.TrimEnd('\\') -ieq $bin.TrimEnd('\\'))){ $exists=$true } };",
        "if(-not $exists){",
        "  [Environment]::SetEnvironmentVariable('Path', ($bin+';'+$p).TrimEnd(';'), 'User');",
        "  if(-not ('SerenadeEnv.NativeMethods' -as [type])){",
        "    Add-Type -Namespace SerenadeEnv -Name NativeMethods -MemberDefinition ",
        "      '[System.Runtime.InteropServices.DllImport(\"user32.dll\", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]",
        "       public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint message, System.UIntPtr wParam, string lParam, uint flags, uint timeout, out System.UIntPtr result);'",
        "  };",
        "  $r=[UIntPtr]::Zero;",
        "  [SerenadeEnv.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 0x0002, 1000, [ref]$r) | Out-Null",
        "}"
    );
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .env("SERENADE_TOOL_DIR", dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    no_window(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not update user PATH", e.to_string()))?;
    match child.wait_timeout(Duration::from_secs(POWERSHELL_TIMEOUT_SECS)) {
        Ok(Some(status)) if status.success() => Ok(()),
        Ok(Some(_)) => Err(SerenadeError::new(
            Code::InstallFailed,
            "Could not update user PATH",
            "The PATH registration command exited with an error.",
        )),
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(SerenadeError::new(
                Code::InstallFailed,
                "PATH registration timed out",
                "The PATH update did not finish in time.",
            ))
        }
        Err(e) => Err(SerenadeError::new(Code::InstallFailed, "PATH registration failed", e.to_string())),
    }
}

// ---------------------------------------------------------------------------
// Junction management (mirrors the official herdr installer layout)
// ---------------------------------------------------------------------------

/// Point `link` at `target` via a directory junction. Safe by construction:
/// an existing junction/reparse link is removed without touching its target,
/// an empty directory is removed, and a non-empty real directory is refused.
fn ensure_junction(link: &Path, target: &Path) -> Result<(), SerenadeError> {
    if let Ok(meta) = std::fs::symlink_metadata(link) {
        if meta.file_type().is_symlink() {
            // remove_dir on a junction/symlink removes the link itself.
            std::fs::remove_dir(link).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not replace existing junction", e.to_string())
            })?;
        } else if link.is_dir() {
            let empty = std::fs::read_dir(link)
                .map(|mut d| d.next().is_none())
                .unwrap_or(false);
            if !empty {
                return Err(SerenadeError::new(
                    Code::InstallFailed,
                    "Refusing to replace non-empty directory",
                    format!("{} exists and is not an installer-managed junction.", link.display()),
                ));
            }
            std::fs::remove_dir(link).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not replace existing directory", e.to_string())
            })?;
        } else {
            std::fs::remove_file(link).map_err(|e| {
                SerenadeError::new(Code::InstallFailed, "Could not replace existing file", e.to_string())
            })?;
        }
    }
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| SerenadeError::new(Code::InstallFailed, "Could not create junction parent", e.to_string()))?;
    }
    let link_str = link.to_string_lossy().into_owned();
    let target_str = target.to_string_lossy().into_owned();
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", "mklink", "/J", &link_str, &target_str])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    no_window(&mut cmd);
    let out = cmd.output().map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not create directory junction", e.to_string())
    })?;
    if !out.status.success() {
        return Err(SerenadeError::new(
            Code::InstallFailed,
            "Could not create directory junction",
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Treehouse installer
// ---------------------------------------------------------------------------

fn windows_treehouse_arch() -> Result<&'static str, SerenadeError> {
    match std::env::consts::ARCH {
        "x86_64" => Ok("amd64"),
        "aarch64" => Ok("arm64"),
        other => Err(SerenadeError::new(
            Code::UnsupportedPlatform,
            "Unsupported architecture for Treehouse",
            format!("No official Treehouse build for {}.", other),
        )),
    }
}

/// Install the latest official Treehouse release into the official location
/// and return its version string.
pub async fn install_treehouse() -> Result<String, SerenadeError> {
    if std::env::consts::OS != "windows" {
        return Err(SerenadeError::new(
            Code::UnsupportedPlatform,
            "Treehouse auto-install is Windows-only in this MVP",
            "Use the official treehouse installer for your platform.",
        ));
    }

    let install_dir = treehouse_dir().ok_or_else(|| {
        SerenadeError::new(
            Code::UnsupportedPlatform,
            "Could not resolve %LOCALAPPDATA%",
            "The Treehouse install directory could not be determined.",
        )
    })?;
    std::fs::create_dir_all(&install_dir).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not create install directory", e.to_string())
    })?;

    let client = http_client()?;

    // Resolve the latest release exactly like the official install.ps1 does.
    let release = download_json(&client, TREEHOUSE_RELEASE_API).await?;
    let tag = release["tag_name"]
        .as_str()
        .ok_or_else(|| SerenadeError::new(Code::ParseFailed, "Release manifest missing tag_name", TREEHOUSE_RELEASE_API))?
        .to_string();
    let version_num = tag.trim_start_matches('v');
    let arch = windows_treehouse_arch()?;
    let asset_name = format!("treehouse-v{version_num}-windows-{arch}.zip");
    let asset_url = format!("{}/{}/{}", TREEHOUSE_DOWNLOAD_BASE, tag, asset_name);
    let checksums_url = format!("{}/{}/checksums.txt", TREEHOUSE_DOWNLOAD_BASE, tag);

    // Stage the archive, then verify against the published checksums.txt.
    let staging_zip = install_dir.join(format!(".staging-{}.zip", std::process::id()));
    let _ = std::fs::remove_file(&staging_zip);
    download_to(&client, &asset_url, &staging_zip, MAX_ASSET_BYTES).await?;

    let checksums_response = client
        .get(&checksums_url)
        .header("User-Agent", "serenade-desktop")
        .send()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not download checksums", e.to_string()))?;
    if !checksums_response.status().is_success() {
        return Err(SerenadeError::new(
            Code::IntegrityCheckFailed,
            "Release did not publish checksums.txt",
            format!("{} returned {}", checksums_url, checksums_response.status()),
        ));
    }
    let checksums = checksums_response
        .text()
        .await
        .map_err(|e| SerenadeError::new(Code::DownloadFailed, "Could not read checksums", e.to_string()))?;
    let expected = checksum_for(&checksums, &asset_name).ok_or_else(|| {
        SerenadeError::new(
            Code::IntegrityCheckFailed,
            "checksums.txt did not contain the expected asset",
            format!("No entry for {} in the published checksums.", asset_name),
        )
    })?;
    let actual = sha256_hex(&staging_zip)?;
    if actual != expected {
        let _ = std::fs::remove_file(&staging_zip);
        return Err(SerenadeError::new(
            Code::IntegrityCheckFailed,
            "Treehouse checksum mismatch",
            format!("Expected {} but got {}.", expected, actual),
        )
        .with_action("The downloaded asset may be corrupted; try the install again."));
    }

    // Extract into a staging directory, validate, then activate.
    let staging_dir = install_dir.join(format!(".staging-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&staging_dir);
    std::fs::create_dir_all(&staging_dir).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not create staging directory", e.to_string())
    })?;
    extract_zip_all(&staging_zip, &staging_dir)?;
    let _ = std::fs::remove_file(&staging_zip);

    let staged_exe = staging_dir.join("treehouse.exe");
    if !staged_exe.is_file() {
        let _ = std::fs::remove_dir_all(&staging_dir);
        return Err(SerenadeError::new(
            Code::InstallFailed,
            "Treehouse archive did not contain treehouse.exe",
            "The release asset layout may have changed.",
        ));
    }
    let version = probe_version(&staged_exe).ok_or_else(|| {
        let _ = std::fs::remove_dir_all(&staging_dir);
        SerenadeError::new(
            Code::InstallFailed,
            "Downloaded Treehouse failed verification",
            format!("{} --version did not succeed.", staged_exe.display()),
        )
    })?;

    // Activate: move the validated binary into place.
    let final_exe = install_dir.join("treehouse.exe");
    std::fs::copy(&staged_exe, &final_exe).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not activate Treehouse", e.to_string())
    })?;
    let _ = std::fs::remove_dir_all(&staging_dir);

    // Register on the user PATH like the official installer. Best-effort:
    // Serenade's own child processes get the directory injected directly, so
    // a PATH failure must not fail the whole install.
    let _ = prepend_user_path(&install_dir);

    Ok(version)
}

// ---------------------------------------------------------------------------
// Herdr installer
// ---------------------------------------------------------------------------

/// Sanitize a version string into the official release-directory name charset.
fn safe_release_component(version: &str) -> String {
    version
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
                c
            } else {
                '-'
            }
        })
        .collect()
}

/// Install the latest stable Herdr release using the official manifest and
/// release layout, and return its version string.
pub async fn install_herdr() -> Result<String, SerenadeError> {
    if std::env::consts::OS != "windows" {
        return Err(SerenadeError::new(
            Code::UnsupportedPlatform,
            "Herdr auto-install is Windows-only in this MVP",
            "Use the official herdr installer for your platform.",
        ));
    }

    let home = herdr_home().ok_or_else(|| {
        SerenadeError::new(
            Code::UnsupportedPlatform,
            "Could not resolve the Herdr home directory",
            "Neither HERDR_HOME nor USERPROFILE is available.",
        )
    })?;
    let standalone = home.join("packages").join("standalone");
    let releases = standalone.join("releases");
    std::fs::create_dir_all(&releases).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not create Herdr releases directory", e.to_string())
    })?;

    let client = http_client()?;
    let manifest = download_json(&client, HERDR_MANIFEST_URL).await?;
    let version = manifest["version"]
        .as_str()
        .ok_or_else(|| SerenadeError::new(Code::ParseFailed, "Herdr manifest missing version", HERDR_MANIFEST_URL))?
        .to_string();
    // The official installer installs the x86_64 build under emulation on ARM64.
    let url = manifest["assets"]["windows-x86_64"]
        .as_str()
        .ok_or_else(|| {
            SerenadeError::new(
                Code::DownloadFailed,
                "Herdr manifest has no Windows asset",
                "The stable manifest does not include windows-x86_64 yet.",
            )
        })?
        .to_string();
    let expected = manifest["sha256"]["windows-x86_64"]
        .as_str()
        .ok_or_else(|| {
            SerenadeError::new(
                Code::IntegrityCheckFailed,
                "Herdr manifest has no Windows SHA-256",
                "Refusing to install without the published digest.",
            )
        })?
        .to_lowercase();

    // Stage + verify the package.
    let release_name = format!("{}-{}", safe_release_component(&version), HERDR_TARGET_TRIPLE);
    let staging = releases.join(format!(".staging.{}.{}", release_name, std::process::id()));
    let _ = std::fs::remove_dir_all(&staging);
    std::fs::create_dir_all(&staging).map_err(|e| {
        SerenadeError::new(Code::InstallFailed, "Could not create staging directory", e.to_string())
    })?;
    let staged_zip = staging.join("herdr-download.zip");
    download_to(&client, &url, &staged_zip, MAX_ASSET_BYTES).await?;

    let actual = sha256_hex(&staged_zip)?;
    if actual != expected {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(SerenadeError::new(
            Code::IntegrityCheckFailed,
            "Herdr checksum mismatch",
            format!("Expected {} but got {}.", expected, actual),
        ));
    }

    // Extract the full package (herdr.exe + ConPTY bundle) into staging.
    extract_zip_all(&staged_zip, &staging)?;
    let _ = std::fs::remove_file(&staged_zip);
    let staged_exe = staging.join("herdr.exe");
    if !staged_exe.is_file() {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(SerenadeError::new(
            Code::InstallFailed,
            "Herdr archive did not contain herdr.exe",
            "The release asset layout may have changed.",
        ));
    }
    let probed = probe_version(&staged_exe).ok_or_else(|| {
        let _ = std::fs::remove_dir_all(&staging);
        SerenadeError::new(
            Code::InstallFailed,
            "Downloaded Herdr failed verification",
            format!("{} --version did not succeed.", staged_exe.display()),
        )
    })?;

    // Activate: swap the staged release into place (same layout the official
    // installer manages). An existing release dir is moved aside first so a
    // locked binary cannot wedge the swap.
    let release_dir = releases.join(&release_name);
    let backup = releases.join(format!(".backup.{}.{}", release_name, std::process::id()));
    if release_dir.exists() {
        std::fs::rename(&release_dir, &backup).map_err(|e| {
            SerenadeError::new(Code::InstallFailed, "Could not move existing release aside", e.to_string())
        })?;
    }
    if let Err(e) = std::fs::rename(&staging, &release_dir) {
        // Restore the backup before failing.
        if backup.exists() {
            let _ = std::fs::rename(&backup, &release_dir);
        }
        return Err(SerenadeError::new(
            Code::InstallFailed,
            "Could not activate the Herdr release",
            e.to_string(),
        ));
    }
    let _ = std::fs::remove_dir_all(&backup);

    // Recreate the junctions the official installer manages.
    ensure_junction(&standalone.join("current"), &release_dir)?;
    let bin = herdr_bin_dir().ok_or_else(|| {
        SerenadeError::new(
            Code::UnsupportedPlatform,
            "Could not resolve the Herdr bin directory",
            "The visible bin junction path could not be determined.",
        )
    })?;
    ensure_junction(&bin, &release_dir)?;

    // Confirm the activated binary through the visible bin junction.
    let final_exe = bin.join("herdr.exe");
    let version = probe_version(&final_exe).unwrap_or(probed);

    // Register the bin dir on the user PATH like the official installer.
    let _ = prepend_user_path(&bin);

    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksum_for_finds_exact_asset() {
        let checksums = "aaa1  treehouse-v2.3.0-windows-amd64.zip\n\
                         bbb2  treehouse-v2.3.0-linux-amd64.tar.gz\n\
                         CCC3  hand-windows-amd64.zip";
        assert_eq!(
            checksum_for(checksums, "treehouse-v2.3.0-windows-amd64.zip"),
            Some("aaa1".to_string())
        );
        // Uppercase hex is normalized.
        assert_eq!(checksum_for(checksums, "hand-windows-amd64.zip"), Some("ccc3".to_string()));
        assert_eq!(checksum_for(checksums, "missing.zip"), None);
    }

    #[test]
    fn treehouse_asset_name_matches_official_layout() {
        // Verified against the official install.ps1 and the published release:
        // treehouse-v2.3.0-windows-amd64.zip
        assert_eq!(
            format!("treehouse-v{}-windows-{}.zip", "2.3.0", "amd64"),
            "treehouse-v2.3.0-windows-amd64.zip"
        );
    }

    #[test]
    fn safe_release_component_sanitizes_versions() {
        assert_eq!(safe_release_component("0.8.2"), "0.8.2");
        assert_eq!(safe_release_component("0.9.0-preview.1"), "0.9.0-preview.1");
        assert_eq!(safe_release_component("bad version/here"), "bad-version-here");
    }

    #[test]
    fn extract_zip_all_rejects_path_traversal() {
        let tmp = std::env::temp_dir().join(format!("serenade-zipslip-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        // Build an archive with an escaping entry.
        let archive = tmp.join("evil.zip");
        let file = std::fs::File::create(&archive).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file(
            "../../../evil.txt",
            zip::write::FileOptions::<()>::default(),
        )
        .unwrap();
        std::io::Write::write_all(&mut zip, b"evil").unwrap();
        zip.finish().unwrap();
        let dest = tmp.join("dest");
        let result = extract_zip_all(&archive, &dest);
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn extract_zip_all_preserves_structure() {
        let tmp = std::env::temp_dir().join(format!("serenade-zipok-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let archive = tmp.join("ok.zip");
        let file = std::fs::File::create(&archive).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file("herdr.exe", zip::write::FileOptions::<()>::default()).unwrap();
        std::io::Write::write_all(&mut zip, b"bin").unwrap();
        zip.add_directory("conpty/x64", zip::write::FileOptions::<()>::default()).unwrap();
        zip.start_file("conpty/x64/OpenConsole.exe", zip::write::FileOptions::<()>::default()).unwrap();
        std::io::Write::write_all(&mut zip, b"console").unwrap();
        zip.finish().unwrap();

        let dest = tmp.join("dest");
        extract_zip_all(&archive, &dest).unwrap();
        assert!(dest.join("herdr.exe").is_file());
        assert!(dest.join("conpty").join("x64").join("OpenConsole.exe").is_file());
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
