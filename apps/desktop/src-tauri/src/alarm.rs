use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

const ALARM_STATE_FILE: &str = "alarm_state.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AlarmStatus {
    Pending,
    Snoozed,
    Fired,
    Dismissed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlarmRecord {
    pub alarm_id: String,
    pub task_id: i64,
    pub workspace_id: i64,
    pub title: String,
    pub start_at_unix: i64,
    pub trigger_at_unix: i64,
    pub next_trigger_at_unix: Option<i64>,
    pub status: AlarmStatus,
    pub is_enabled: bool,
    pub reminder_minutes_before: i64,
    pub last_triggered_at_unix: Option<i64>,
    pub created_at_unix: i64,
    pub updated_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlarmManagerState {
    #[serde(default = "default_notifications_enabled")]
    pub notifications_enabled: bool,
    #[serde(default)]
    pub alarms: Vec<AlarmRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAlarmInput {
    pub task_id: i64,
    pub workspace_id: i64,
    pub title: String,
    pub start_at_unix: i64,
    #[serde(default)]
    pub reminder_minutes_before: Option<i64>,
    #[serde(default)]
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AlarmTriggeredPayload {
    pub alarm_id: String,
    pub task_id: i64,
    pub workspace_id: i64,
    pub title: String,
    pub message: String,
    pub scheduled_start_at_unix: i64,
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn default_notifications_enabled() -> bool {
    true
}

fn default_state() -> AlarmManagerState {
    AlarmManagerState {
        notifications_enabled: default_notifications_enabled(),
        alarms: Vec::new(),
    }
}

fn alarm_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(ALARM_STATE_FILE))
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

pub fn load_alarm_manager(app: &tauri::AppHandle) -> AlarmManagerState {
    let path = match alarm_state_path(app) {
        Ok(path) => path,
        Err(_) => return default_state(),
    };
    read_json::<AlarmManagerState>(&path).unwrap_or_else(default_state)
}

fn save_alarm_manager(app: &tauri::AppHandle, state: &AlarmManagerState) -> Result<(), String> {
    let path = alarm_state_path(app)?;
    write_json(&path, state)
}

fn alarm_id_for_task(workspace_id: i64, task_id: i64, start_at_unix: i64) -> String {
    format!("task:{}:{}:{}", workspace_id, task_id, start_at_unix)
}

fn build_alarm_from_input(input: &TaskAlarmInput, now: i64) -> AlarmRecord {
    let reminder = input.reminder_minutes_before.unwrap_or(10).max(0);
    let trigger_at = input.start_at_unix - (reminder * 60);
    let enabled = input.is_enabled.unwrap_or(true);
    let alarm_id = alarm_id_for_task(input.workspace_id, input.task_id, input.start_at_unix);

    if !enabled || input.start_at_unix <= now {
        return AlarmRecord {
            alarm_id,
            task_id: input.task_id,
            workspace_id: input.workspace_id,
            title: input.title.clone(),
            start_at_unix: input.start_at_unix,
            trigger_at_unix: trigger_at,
            next_trigger_at_unix: None,
            status: AlarmStatus::Dismissed,
            is_enabled: false,
            reminder_minutes_before: reminder,
            last_triggered_at_unix: None,
            created_at_unix: now,
            updated_at_unix: now,
        };
    }

    AlarmRecord {
        alarm_id,
        task_id: input.task_id,
        workspace_id: input.workspace_id,
        title: input.title.clone(),
        start_at_unix: input.start_at_unix,
        trigger_at_unix: trigger_at,
        next_trigger_at_unix: Some(trigger_at.max(now)),
        status: AlarmStatus::Pending,
        is_enabled: true,
        reminder_minutes_before: reminder,
        last_triggered_at_unix: None,
        created_at_unix: now,
        updated_at_unix: now,
    }
}

#[tauri::command]
pub fn set_alarm_notifications_enabled(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AlarmManagerState>>,
    enabled: bool,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;
    guard.notifications_enabled = enabled;
    save_alarm_manager(&app, &guard)
}

#[tauri::command]
pub fn get_alarm_manager_state(state: State<'_, Mutex<AlarmManagerState>>) -> Result<AlarmManagerState, String> {
    let guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn clear_workspace_task_alarms(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AlarmManagerState>>,
    workspace_id: i64,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;
    guard
        .alarms
        .retain(|alarm| !(alarm.workspace_id == workspace_id && alarm.alarm_id.starts_with("task:")));
    save_alarm_manager(&app, &guard)
}

#[tauri::command]
pub fn sync_task_alarms(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AlarmManagerState>>,
    alarms: Vec<TaskAlarmInput>,
) -> Result<usize, String> {
    let now = now_unix();
    let incoming_workspace_ids: HashSet<i64> = alarms.iter().map(|a| a.workspace_id).collect();

    let mut incoming_ids: HashSet<String> = HashSet::new();
    let mut normalized: Vec<AlarmRecord> = Vec::new();
    for input in &alarms {
        let record = build_alarm_from_input(input, now);
        incoming_ids.insert(record.alarm_id.clone());
        normalized.push(record);
    }

    let mut guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;

    // Keep existing alarms except task alarms in affected workspaces that are not in incoming ids.
    let mut kept: Vec<AlarmRecord> = guard
        .alarms
        .iter()
        .filter(|existing| {
            if !existing.alarm_id.starts_with("task:") {
                return true;
            }
            if !incoming_workspace_ids.contains(&existing.workspace_id) {
                return true;
            }
            incoming_ids.contains(&existing.alarm_id)
        })
        .cloned()
        .collect();

    // Replace/append incoming alarms. Preserve snoozed/dismissed state for unchanged schedules.
    for mut incoming in normalized {
        if let Some(existing) = guard
            .alarms
            .iter()
            .find(|a| a.alarm_id == incoming.alarm_id)
        {
            if existing.start_at_unix == incoming.start_at_unix {
                if matches!(existing.status, AlarmStatus::Snoozed | AlarmStatus::Dismissed) {
                    incoming.status = existing.status.clone();
                    incoming.next_trigger_at_unix = existing.next_trigger_at_unix;
                }
                incoming.last_triggered_at_unix = existing.last_triggered_at_unix;
                incoming.created_at_unix = existing.created_at_unix;
            }
        }
        incoming.updated_at_unix = now;
        kept.retain(|a| a.alarm_id != incoming.alarm_id);
        kept.push(incoming);
    }

    guard.alarms = kept;
    save_alarm_manager(&app, &guard)?;
    Ok(guard.alarms.len())
}

#[tauri::command]
pub fn snooze_alarm(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AlarmManagerState>>,
    alarm_id: String,
    minutes: i64,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;
    let now = now_unix();
    let snooze_until = now + (minutes.max(1) * 60);

    let alarm = guard
        .alarms
        .iter_mut()
        .find(|a| a.alarm_id == alarm_id)
        .ok_or_else(|| "Alarm not found".to_string())?;

    alarm.status = AlarmStatus::Snoozed;
    alarm.next_trigger_at_unix = Some(snooze_until);
    alarm.is_enabled = true;
    alarm.updated_at_unix = now;
    save_alarm_manager(&app, &guard)
}

#[tauri::command]
pub fn dismiss_alarm(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AlarmManagerState>>,
    alarm_id: String,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Failed to lock alarm state".to_string())?;
    let now = now_unix();

    let alarm = guard
        .alarms
        .iter_mut()
        .find(|a| a.alarm_id == alarm_id)
        .ok_or_else(|| "Alarm not found".to_string())?;

    alarm.status = AlarmStatus::Dismissed;
    alarm.next_trigger_at_unix = None;
    alarm.is_enabled = false;
    alarm.updated_at_unix = now;
    save_alarm_manager(&app, &guard)
}

pub fn start_alarm_scheduler(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(15));
        let now = now_unix();

        let mut triggered: Vec<AlarmTriggeredPayload> = Vec::new();
        let mut should_save = false;

        if let Some(state) = app.try_state::<Mutex<AlarmManagerState>>() {
            if let Ok(mut guard) = state.lock() {
                if guard.notifications_enabled {
                    for alarm in guard.alarms.iter_mut() {
                        if !alarm.is_enabled {
                            continue;
                        }
                        if !matches!(alarm.status, AlarmStatus::Pending | AlarmStatus::Snoozed) {
                            continue;
                        }
                        let due = alarm.next_trigger_at_unix.unwrap_or(alarm.trigger_at_unix);
                        if due > now {
                            continue;
                        }

                        alarm.status = AlarmStatus::Fired;
                        alarm.last_triggered_at_unix = Some(now);
                        alarm.updated_at_unix = now;
                        should_save = true;

                        triggered.push(AlarmTriggeredPayload {
                            alarm_id: alarm.alarm_id.clone(),
                            task_id: alarm.task_id,
                            workspace_id: alarm.workspace_id,
                            title: alarm.title.clone(),
                            message: format!("{} 일정 시간이 되었습니다.", alarm.title),
                            scheduled_start_at_unix: alarm.start_at_unix,
                        });
                    }
                }

                if should_save {
                    let _ = save_alarm_manager(&app, &guard);
                }
            }
        }

        for payload in triggered {
            let _ = app.emit("alarm://trigger", payload);
        }
    });
}
