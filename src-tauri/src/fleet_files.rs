//! Fleet-home file access — read-only on hand-owned state, write only to
//! briefs (`data/<id>/brief.md`), which the operator owns pre-spawn.
//! See docs/hand-integration-notes.md §6.

use crate::error::{Code, SerenadeError};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct FleetFiles {
    pub home: PathBuf,
}

/// hand task id rules: [A-Za-z0-9._-]+, no separators, not . or ..
pub fn valid_task_id(id: &str) -> bool {
    !id.is_empty()
        && id != "."
        && id != ".."
        && id.len() <= 128
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

impl FleetFiles {
    pub fn new(home: PathBuf) -> Self {
        Self { home }
    }

    pub fn state_dir(&self) -> PathBuf {
        self.home.join("state")
    }

    pub fn data_dir(&self) -> PathBuf {
        self.home.join("data")
    }

    /// state/<id>.status — the append-only worker report stream.
    pub fn status_file(&self, task_id: &str) -> PathBuf {
        self.state_dir().join(format!("{task_id}.status"))
    }

    pub fn brief_file(&self, task_id: &str) -> PathBuf {
        self.data_dir().join(task_id).join("brief.md")
    }

    pub fn report_file(&self, task_id: &str) -> PathBuf {
        self.data_dir().join(task_id).join("report.md")
    }

    pub fn events_log(&self) -> PathBuf {
        self.state_dir().join("events.log")
    }

    pub fn read_status_lines(&self, task_id: &str) -> Result<Vec<String>, SerenadeError> {
        let path = self.status_file(task_id);
        match fs::read_to_string(&path) {
            Ok(raw) => Ok(raw.lines().map(str::to_string).filter(|l| !l.trim().is_empty()).collect()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(SerenadeError::new(
                Code::PermissionDenied,
                "Could not read task status file",
                e.to_string(),
            )),
        }
    }

    /// Write the brief. Fails if the task already has one (precondition-style).
    /// `execution_class` is accepted for API symmetry but intentionally not
    /// written (see comment at the body below).
    pub fn write_brief(
        &self,
        task_id: &str,
        title: &str,
        description: Option<&str>,
        _execution_class: &str,
        tags: &[String],
    ) -> Result<(), SerenadeError> {
        if !valid_task_id(task_id) {
            return Err(SerenadeError::new(
                Code::InvalidPath,
                "Invalid task id",
                format!("Task ids may only contain letters, digits, '.', '_' and '-': got {task_id:?}"),
            ));
        }
        let path = self.brief_file(task_id);
        if path.exists() {
            return Err(SerenadeError::new(
                Code::CommandFailed,
                "Brief already exists",
                format!("A brief for {task_id} already exists at {}.", path.display()),
            )
            .with_action("Choose a different title, or reopen the existing task."));
        }
        // No execution_class front-matter: a brief that declares an execution
        // class makes `hand spawn` require a configured route profile
        // ("route <kind>.<class> is not configured"). Omitting it lets spawn
        // fall back to the fleet's configured default harness (legacy routing),
        // which is what the GUI offers. Profiles/routes can be used later by
        // passing --profile at spawn.
        let mut body = String::new();
        body.push_str(&format!("# {title}\n\n"));
        if let Some(desc) = description {
            body.push_str(desc.trim());
            body.push_str("\n\n");
        }
        if !tags.is_empty() {
            body.push_str(&format!("tags: {}\n", tags.join(", ")));
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                SerenadeError::new(Code::PermissionDenied, "Could not create brief directory", e.to_string())
            })?;
        }
        fs::write(&path, body).map_err(|e| {
            SerenadeError::new(Code::PermissionDenied, "Could not write brief", e.to_string())
        })
    }

    pub fn report_exists(&self, task_id: &str) -> bool {
        self.report_file(task_id).is_file()
    }

    pub fn list_report_tasks(&self) -> Vec<(String, SystemTime)> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(self.data_dir()) else {
            return out;
        };
        for entry in entries.flatten() {
            let report = entry.path().join("report.md");
            if report.is_file() {
                let modified = fs::metadata(&report)
                    .and_then(|m| m.modified())
                    .unwrap_or(UNIX_EPOCH);
                out.push((entry.file_name().to_string_lossy().into_owned(), modified));
            }
        }
        out.sort_by(|a, b| b.1.cmp(&a.1));
        out
    }

    /// Brief title: first `# heading` (or first non-empty line) after front-matter.
    pub fn brief_title(&self, task_id: &str) -> Option<String> {
        let raw = fs::read_to_string(self.brief_file(task_id)).ok()?;
        Some(brief_title_from(&raw)).filter(|t| !t.is_empty())
    }

    /// Brief summary: first non-heading, non-empty line, trimmed.
    pub fn brief_summary(&self, task_id: &str) -> Option<String> {
        let raw = fs::read_to_string(self.brief_file(task_id)).ok()?;
        let body = strip_front_matter(&raw);
        for line in body.lines() {
            let t = line.trim();
            if !t.is_empty() && !t.starts_with('#') && !t.starts_with("tags:") && !t.starts_with("---") {
                let mut s: String = t.chars().take(200).collect();
                if t.chars().count() > 200 {
                    s.push('…');
                }
                return Some(s);
            }
        }
        None
    }

    pub fn read_events_log(&self) -> Vec<String> {
        fs::read_to_string(self.events_log())
            .map(|raw| raw.lines().rev().map(str::to_string).filter(|l| !l.trim().is_empty()).collect())
            .unwrap_or_default()
    }
}

pub fn strip_front_matter(raw: &str) -> &str {
    let trimmed = raw.trim_start();
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(end) = rest.find("\n---") {
            return rest[end + 4..].trim_start_matches('\n');
        }
    }
    raw
}

pub fn brief_title_from(raw: &str) -> String {
    let body = strip_front_matter(raw);
    for line in body.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if let Some(heading) = t.strip_prefix("# ") {
            return heading.trim().to_string();
        }
        if !t.starts_with('#') && !t.starts_with("---") {
            return t.chars().take(120).collect();
        }
    }
    String::new()
}

pub fn iso_from_system_time(t: SystemTime) -> String {
    let secs = t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // RFC3339 UTC without a chrono dependency.
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = civil_from_days(days as i64);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

/// Howard Hinnant's days-to-civil algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

pub fn file_mtime(path: &Path) -> Option<String> {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .map(iso_from_system_time)
}
