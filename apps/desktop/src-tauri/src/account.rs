use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const ACCOUNT_FILE: &str = "account_settings.json";
const PREFERENCES_FILE: &str = "user_preferences.json";
const SESSION_FILE: &str = "auth_session.json";
const PROFILE_IMAGE_DIR: &str = "profile_images";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSettings {
    #[serde(default = "default_nickname")]
    pub nickname: String,
    #[serde(default)]
    pub profile_image_path: Option<String>,
    #[serde(default)]
    pub reserved_nicknames: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default = "default_notifications_enabled")]
    pub notifications_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub member_id: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub expires_at_unix: Option<i64>,
}

fn default_nickname() -> String {
    "DeskCal User".to_string()
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_language() -> String {
    "ko".to_string()
}

fn default_timezone() -> String {
    "Asia/Seoul".to_string()
}

fn default_notifications_enabled() -> bool {
    true
}

fn default_account_settings() -> AccountSettings {
    AccountSettings {
        nickname: default_nickname(),
        profile_image_path: None,
        reserved_nicknames: Vec::new(),
    }
}

fn default_user_preferences() -> UserPreferences {
    UserPreferences {
        theme: default_theme(),
        language: default_language(),
        timezone: default_timezone(),
        notifications_enabled: default_notifications_enabled(),
    }
}

fn default_auth_session() -> AuthSession {
    AuthSession {
        provider: None,
        access_token: None,
        refresh_token: None,
        member_id: None,
        nickname: None,
        email: None,
        expires_at_unix: None,
    }
}

fn config_path(app: &tauri::AppHandle, filename: &str) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(filename))
        .map_err(|e| format!("Failed to resolve app config dir: {}", e))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize json: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write file: {}", e))
}

fn normalize_nickname(nickname: &str) -> String {
    nickname.trim().to_lowercase()
}

fn validate_nickname(nickname: &str) -> Result<String, String> {
    let trimmed = nickname.trim();
    let len = trimmed.chars().count();
    if len < 2 || len > 20 {
        return Err("Nickname must be between 2 and 20 characters".to_string());
    }
    Ok(trimmed.to_string())
}

fn load_account_settings(app: &tauri::AppHandle) -> AccountSettings {
    let path = match config_path(app, ACCOUNT_FILE) {
        Ok(path) => path,
        Err(_) => return default_account_settings(),
    };
    read_json::<AccountSettings>(&path).unwrap_or_else(default_account_settings)
}

fn save_account_settings(app: &tauri::AppHandle, settings: &AccountSettings) -> Result<(), String> {
    let path = config_path(app, ACCOUNT_FILE)?;
    write_json(&path, settings)
}

fn load_preferences(app: &tauri::AppHandle) -> UserPreferences {
    let path = match config_path(app, PREFERENCES_FILE) {
        Ok(path) => path,
        Err(_) => return default_user_preferences(),
    };
    read_json::<UserPreferences>(&path).unwrap_or_else(default_user_preferences)
}

fn save_preferences(app: &tauri::AppHandle, preferences: &UserPreferences) -> Result<(), String> {
    let path = config_path(app, PREFERENCES_FILE)?;
    write_json(&path, preferences)
}

fn load_session(app: &tauri::AppHandle) -> AuthSession {
    let path = match config_path(app, SESSION_FILE) {
        Ok(path) => path,
        Err(_) => return default_auth_session(),
    };
    read_json::<AuthSession>(&path).unwrap_or_else(default_auth_session)
}

fn save_session(app: &tauri::AppHandle, session: &AuthSession) -> Result<(), String> {
    let path = config_path(app, SESSION_FILE)?;
    write_json(&path, session)
}

fn clear_session(app: &tauri::AppHandle) -> Result<(), String> {
    let path = config_path(app, SESSION_FILE)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to remove session file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_account_settings(app: tauri::AppHandle) -> AccountSettings {
    load_account_settings(&app)
}

#[tauri::command]
pub fn set_reserved_nicknames(
    app: tauri::AppHandle,
    reserved_nicknames: Vec<String>,
) -> Result<(), String> {
    let mut settings = load_account_settings(&app);
    settings.reserved_nicknames = reserved_nicknames;
    save_account_settings(&app, &settings)
}

#[tauri::command]
pub fn is_nickname_available(app: tauri::AppHandle, nickname: String) -> Result<bool, String> {
    let nickname = validate_nickname(&nickname)?;
    let settings = load_account_settings(&app);

    if normalize_nickname(&settings.nickname) == normalize_nickname(&nickname) {
        return Ok(true);
    }

    let exists = settings
        .reserved_nicknames
        .iter()
        .any(|used| normalize_nickname(used) == normalize_nickname(&nickname));

    Ok(!exists)
}

#[tauri::command]
pub fn update_nickname(app: tauri::AppHandle, nickname: String) -> Result<AccountSettings, String> {
    let nickname = validate_nickname(&nickname)?;
    let mut settings = load_account_settings(&app);

    let duplicated = settings
        .reserved_nicknames
        .iter()
        .any(|used| normalize_nickname(used) == normalize_nickname(&nickname))
        && normalize_nickname(&settings.nickname) != normalize_nickname(&nickname);

    if duplicated {
        return Err("Nickname is already in use".to_string());
    }

    settings.nickname = nickname;
    save_account_settings(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn upload_profile_image(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.exists() {
        return Err("Profile image source file does not exist".to_string());
    }
    if !source.is_file() {
        return Err("Profile image source path is not a file".to_string());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let profile_dir = config_path(&app, PROFILE_IMAGE_DIR)?;
    fs::create_dir_all(&profile_dir)
        .map_err(|e| format!("Failed to create profile image directory: {}", e))?;

    let filename = format!(
        "profile_{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to read system time: {}", e))?
            .as_millis(),
        ext
    );
    let target = profile_dir.join(filename);
    fs::copy(&source, &target).map_err(|e| format!("Failed to copy profile image: {}", e))?;

    let mut settings = load_account_settings(&app);
    if let Some(old_path) = settings.profile_image_path.as_deref() {
        let old = PathBuf::from(old_path);
        if old.exists() {
            let _ = fs::remove_file(old);
        }
    }

    let target_str = target.to_string_lossy().to_string();
    settings.profile_image_path = Some(target_str.clone());
    save_account_settings(&app, &settings)?;

    Ok(target_str)
}

#[tauri::command]
pub fn delete_profile_image(app: tauri::AppHandle) -> Result<(), String> {
    let mut settings = load_account_settings(&app);
    if let Some(path) = settings.profile_image_path.as_deref() {
        let profile = PathBuf::from(path);
        if profile.exists() {
            fs::remove_file(profile)
                .map_err(|e| format!("Failed to delete profile image: {}", e))?;
        }
    }
    settings.profile_image_path = None;
    save_account_settings(&app, &settings)
}

#[tauri::command]
pub fn get_user_preferences(app: tauri::AppHandle) -> UserPreferences {
    load_preferences(&app)
}

#[tauri::command]
pub fn save_user_preferences(
    app: tauri::AppHandle,
    preferences: UserPreferences,
) -> Result<UserPreferences, String> {
    save_preferences(&app, &preferences)?;
    Ok(preferences)
}

#[tauri::command]
pub fn get_auth_session(app: tauri::AppHandle) -> AuthSession {
    load_session(&app)
}

#[tauri::command]
pub fn save_auth_session(app: tauri::AppHandle, session: AuthSession) -> Result<(), String> {
    save_session(&app, &session)
}

#[tauri::command]
pub fn clear_auth_session(app: tauri::AppHandle) -> Result<(), String> {
    clear_session(&app)
}

#[tauri::command]
pub fn logout(app: tauri::AppHandle) -> Result<(), String> {
    clear_session(&app)
}
