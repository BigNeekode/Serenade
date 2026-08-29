use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// GUI-owned configuration, stored separately from hand's own config
/// (architecture.md §19). Never rewrites hand configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationsConfig {
    pub worker_failed: bool,
    pub task_completed: bool,
    pub report_ready: bool,
    pub approval_required: bool,
}

impl Default for NotificationsConfig {
    fn default() -> Self {
        Self {
            worker_failed: true,
            task_completed: true,
            report_ready: true,
            approval_required: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default = "default_hand_path")]
    pub hand_binary_path: String,
    #[serde(default)]
    pub fleet_path: Option<String>,
    #[serde(default = "default_supervisor_harness")]
    pub supervisor_harness: String,
    #[serde(default = "default_editor")]
    pub preferred_editor: String,
    #[serde(default)]
    pub custom_editor_path: Option<String>,
    #[serde(default = "default_refresh")]
    pub refresh_profile: String,
    #[serde(default = "default_appearance")]
    pub appearance: String,
    #[serde(default = "default_density")]
    pub density: String,
    #[serde(default)]
    pub reduced_motion: bool,
    #[serde(default)]
    pub notifications: NotificationsConfig,
    #[serde(default)]
    pub setup_completed: bool,
}

fn default_hand_path() -> String {
    "hand".to_string()
}
fn default_supervisor_harness() -> String {
    "opencode".to_string()
}
fn default_editor() -> String {
    "vscode".to_string()
}
fn default_refresh() -> String {
    "default".to_string()
}
fn default_appearance() -> String {
    "dark".to_string()
}
fn default_density() -> String {
    "comfortable".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hand_binary_path: default_hand_path(),
            fleet_path: None,
            supervisor_harness: default_supervisor_harness(),
            preferred_editor: default_editor(),
            custom_editor_path: None,
            refresh_profile: default_refresh(),
            appearance: default_appearance(),
            density: default_density(),
            reduced_motion: false,
            notifications: NotificationsConfig::default(),
            setup_completed: false,
        }
    }
}

pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            path: app_data_dir.join("serenade-config.json"),
        }
    }

    pub fn load(&self) -> AppConfig {
        fs::read_to_string(&self.path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let raw = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&self.path, raw).map_err(|e| e.to_string())
    }

    /// Merge a partial update. `input` is a JSON object; presence of a key
    /// (including explicit null for nullable fields) drives the merge.
    pub fn update(&self, input: serde_json::Value) -> Result<AppConfig, String> {
        let mut config = self.load();
        let obj = match input.as_object() {
            Some(o) => o,
            None => return Err("config update must be an object".to_string()),
        };
        for (key, value) in obj {
            match key.as_str() {
                "handBinaryPath" => {
                    config.hand_binary_path =
                        value.as_str().map(str::to_string).unwrap_or_else(default_hand_path)
                }
                "fleetPath" => config.fleet_path = value.as_str().map(str::to_string),
                "supervisorHarness" => {
                    if let Some(s) = value.as_str() {
                        // Only OpenCode is qualified today. Persisting an
                        // arbitrary executable here would accidentally turn UI
                        // configuration into an unverified Harness adapter.
                        if s == "opencode" {
                            config.supervisor_harness = s.to_string();
                        }
                    }
                }
                "preferredEditor" => {
                    if let Some(s) = value.as_str() {
                        config.preferred_editor = s.to_string();
                    }
                }
                "customEditorPath" => config.custom_editor_path = value.as_str().map(str::to_string),
                "refreshProfile" => {
                    if let Some(s) = value.as_str() {
                        config.refresh_profile = s.to_string();
                    }
                }
                "appearance" => {
                    if let Some(s) = value.as_str() {
                        config.appearance = s.to_string();
                    }
                }
                "density" => {
                    if let Some(s) = value.as_str() {
                        config.density = s.to_string();
                    }
                }
                "reducedMotion" => {
                    if let Some(b) = value.as_bool() {
                        config.reduced_motion = b;
                    }
                }
                "notifications" => {
                    if let Some(n) = value.as_object() {
                        let mut notif = config.notifications.clone();
                        for (nk, nv) in n {
                            if let Some(b) = nv.as_bool() {
                                match nk.as_str() {
                                    "workerFailed" => notif.worker_failed = b,
                                    "taskCompleted" => notif.task_completed = b,
                                    "reportReady" => notif.report_ready = b,
                                    "approvalRequired" => notif.approval_required = b,
                                    _ => {}
                                }
                            }
                        }
                        config.notifications = notif;
                    }
                }
                "setupCompleted" => {
                    if let Some(b) = value.as_bool() {
                        config.setup_completed = b;
                    }
                }
                _ => {}
            }
        }
        self.save(&config)?;
        Ok(config)
    }
}
