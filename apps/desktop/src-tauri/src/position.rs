/// Window state persistence — save / restore position, size, opacity across launches.
///
/// Stored as a small JSON file in the Tauri app-config directory.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const STATE_FILE: &str = "window_state.json";
const MIN_WIDTH: f64 = 760.0;
const MIN_HEIGHT: f64 = 600.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: f64,
    pub y: f64,
    #[serde(default = "default_width")]
    pub width: f64,
    #[serde(default = "default_height")]
    pub height: f64,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
}

fn default_width() -> f64 { 780.0 }
fn default_height() -> f64 { 660.0 }
fn default_opacity() -> f64 { 100.0 }

fn state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(STATE_FILE))
}

/// 디스크에서 저장된 상태 읽기 (이전 형식도 호환)
pub fn load_state(app: &tauri::AppHandle) -> Option<WindowState> {
    let path = state_path(app)?;
    let data = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

/// 현재 상태를 디스크에 저장
pub fn save_state(app: &tauri::AppHandle, state: &WindowState) {
    if let Some(path) = state_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(state) {
            let _ = fs::write(&path, json);
        }
    }
}

/// 현재 저장된 상태를 읽고 일부 필드만 업데이트하여 저장
fn update_state(app: &tauri::AppHandle, f: impl FnOnce(&mut WindowState)) {
    let mut state = load_state(app).unwrap_or(WindowState {
        x: 100.0,
        y: 100.0,
        width: default_width(),
        height: default_height(),
        opacity: default_opacity(),
    });
    f(&mut state);
    save_state(app, &state);
}

/// 위치 저장
pub fn save_position(app: &tauri::AppHandle, x: f64, y: f64) {
    update_state(app, |s| {
        s.x = x;
        s.y = y;
    });
}

/// 크기 저장 (최소 크기 미만이면 무시)
pub fn save_size(app: &tauri::AppHandle, width: f64, height: f64) {
    if width < MIN_WIDTH || height < MIN_HEIGHT {
        return;
    }
    update_state(app, |s| {
        s.width = width;
        s.height = height;
    });
}

/// 투명도 저장
pub fn save_opacity(app: &tauri::AppHandle, opacity: f64) {
    update_state(app, |s| {
        s.opacity = opacity;
    });
}

// ── Tauri commands ──────────────────────────────────────────────

#[tauri::command]
pub fn save_window_position(app: tauri::AppHandle, x: f64, y: f64) {
    save_position(&app, x, y);
}

#[tauri::command]
pub fn save_window_size(app: tauri::AppHandle, width: f64, height: f64) {
    save_size(&app, width, height);
}

#[tauri::command]
pub fn save_window_opacity(app: tauri::AppHandle, opacity: f64) {
    save_opacity(&app, opacity);
}

#[tauri::command]
pub fn get_window_opacity(app: tauri::AppHandle) -> f64 {
    load_state(&app).map(|s| s.opacity).unwrap_or(default_opacity())
}

/// setup에서 호출 — 위치 + 크기 + 투명도 복원
pub fn restore_state(app: &tauri::AppHandle) {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };

    match load_state(app) {
        Some(state) => {
            // 최소 크기 보장
            let width = state.width.max(MIN_WIDTH);
            let height = state.height.max(MIN_HEIGHT);

            // 위치 복원
            let _ = window.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition {
                    x: state.x as i32,
                    y: state.y as i32,
                },
            ));

            // 크기 복원
            let _ = window.set_size(tauri::Size::Physical(
                tauri::PhysicalSize {
                    width: width as u32,
                    height: height as u32,
                },
            ));

            log::info!(
                "state: restored pos({}, {}), size({}x{}), opacity({}%)",
                state.x, state.y, width, height, state.opacity
            );
        }
        None => {
            // 첫 실행: 기본 크기를 명시적으로 설정하고 화면 중앙에 배치
            let _ = window.set_size(tauri::Size::Logical(
                tauri::LogicalSize {
                    width: default_width(),
                    height: default_height(),
                },
            ));
            let _ = window.center();

            log::info!(
                "state: first launch — centered with default size ({}x{})",
                default_width(),
                default_height()
            );
        }
    }
}
