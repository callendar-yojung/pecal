use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const WORKSPACE_STATE_FILE: &str = "workspace_state.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceType {
    Personal,
    Team,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub workspace_type: WorkspaceType,
    #[serde(default)]
    pub plan_tier: Option<String>,
    #[serde(default)]
    pub team_id: Option<i64>,
    pub created_at_unix: i64,
    pub updated_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceState {
    #[serde(default)]
    pub current_workspace_id: Option<String>,
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TeamWorkspaceCreationPath {
    pub status: String,
    pub route: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TeamWorkspaceCreationResult {
    pub status: String,
    pub message: String,
    pub route: String,
    pub workspace: Option<Workspace>,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn new_team_id() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_else(|_| now_unix())
}

fn new_workspace_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("ws_{}", ts)
}

fn normalize_plan(plan_tier: &str) -> String {
    let normalized = plan_tier.trim().to_lowercase();
    if normalized.is_empty() {
        "free".to_string()
    } else {
        normalized
    }
}

fn is_paid_plan(plan_tier: &str) -> bool {
    matches!(
        normalize_plan(plan_tier).as_str(),
        "pro" | "plus" | "team" | "business" | "enterprise" | "paid" | "premium"
    )
}

fn validate_workspace_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    let len = trimmed.chars().count();
    if len == 0 {
        return Err("Workspace name is required".to_string());
    }
    if len > 50 {
        return Err("Workspace name must be 50 characters or less".to_string());
    }
    Ok(trimmed.to_string())
}

fn workspace_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(WORKSPACE_STATE_FILE))
        .map_err(|e| format!("Failed to resolve app config dir: {}", e))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| format!("Failed to serialize json: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write file: {}", e))
}

fn default_personal_workspace() -> Workspace {
    let now = now_unix();
    Workspace {
        id: new_workspace_id(),
        name: "내 워크스페이스".to_string(),
        workspace_type: WorkspaceType::Personal,
        plan_tier: None,
        team_id: None,
        created_at_unix: now,
        updated_at_unix: now,
    }
}

fn ensure_valid_state(mut state: WorkspaceState) -> WorkspaceState {
    if state.workspaces.is_empty() {
        let ws = default_personal_workspace();
        state.current_workspace_id = Some(ws.id.clone());
        state.workspaces.push(ws);
        return state;
    }

    let current_exists = state
        .current_workspace_id
        .as_ref()
        .map(|id| state.workspaces.iter().any(|ws| &ws.id == id))
        .unwrap_or(false);

    if !current_exists {
        state.current_workspace_id = state.workspaces.first().map(|ws| ws.id.clone());
    }

    state
}

fn load_state(app: &tauri::AppHandle) -> WorkspaceState {
    let path = match workspace_state_path(app) {
        Ok(path) => path,
        Err(_) => {
            return ensure_valid_state(WorkspaceState {
                current_workspace_id: None,
                workspaces: Vec::new(),
            });
        }
    };

    let state = read_json::<WorkspaceState>(&path).unwrap_or(WorkspaceState {
        current_workspace_id: None,
        workspaces: Vec::new(),
    });
    ensure_valid_state(state)
}

fn save_state(app: &tauri::AppHandle, state: &WorkspaceState) -> Result<(), String> {
    let path = workspace_state_path(app)?;
    write_json(&path, state)
}

fn update_state(
    app: &tauri::AppHandle,
    f: impl FnOnce(&mut WorkspaceState) -> Result<(), String>,
) -> Result<WorkspaceState, String> {
    let mut state = load_state(app);
    f(&mut state)?;
    let state = ensure_valid_state(state);
    save_state(app, &state)?;
    Ok(state)
}

#[tauri::command]
pub fn get_workspace_state(app: tauri::AppHandle) -> WorkspaceState {
    load_state(&app)
}

#[tauri::command]
pub fn list_personal_workspaces(app: tauri::AppHandle) -> Vec<Workspace> {
    let state = load_state(&app);
    state
        .workspaces
        .into_iter()
        .filter(|ws| ws.workspace_type == WorkspaceType::Personal)
        .collect()
}

#[tauri::command]
pub fn list_team_workspaces(app: tauri::AppHandle) -> Vec<Workspace> {
    let state = load_state(&app);
    state
        .workspaces
        .into_iter()
        .filter(|ws| ws.workspace_type == WorkspaceType::Team)
        .collect()
}

#[tauri::command]
pub fn get_current_workspace(app: tauri::AppHandle) -> Option<Workspace> {
    let state = load_state(&app);
    let id = state.current_workspace_id?;
    state.workspaces.into_iter().find(|ws| ws.id == id)
}

#[tauri::command]
pub fn switch_workspace(app: tauri::AppHandle, workspace_id: String) -> Result<Workspace, String> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err("workspace_id is required".to_string());
    }

    let state = update_state(&app, |state| {
        if state.workspaces.iter().any(|ws| ws.id == workspace_id) {
            state.current_workspace_id = Some(workspace_id.to_string());
            Ok(())
        } else {
            Err("Workspace not found".to_string())
        }
    })?;

    let current_id = state.current_workspace_id.unwrap_or_default();
    state
        .workspaces
        .into_iter()
        .find(|ws| ws.id == current_id)
        .ok_or_else(|| "Workspace not found".to_string())
}

#[tauri::command]
pub fn create_workspace(app: tauri::AppHandle, name: String) -> Result<Workspace, String> {
    let name = validate_workspace_name(&name)?;
    let mut created: Option<Workspace> = None;

    update_state(&app, |state| {
        let now = now_unix();
        let workspace = Workspace {
            id: new_workspace_id(),
            name: name.clone(),
            workspace_type: WorkspaceType::Personal,
            plan_tier: None,
            team_id: None,
            created_at_unix: now,
            updated_at_unix: now,
        };
        state.current_workspace_id = Some(workspace.id.clone());
        state.workspaces.push(workspace.clone());
        created = Some(workspace);
        Ok(())
    })?;

    created.ok_or_else(|| "Failed to create workspace".to_string())
}

#[tauri::command]
pub fn rename_workspace(
    app: tauri::AppHandle,
    workspace_id: String,
    name: String,
) -> Result<Workspace, String> {
    let name = validate_workspace_name(&name)?;
    let mut updated: Option<Workspace> = None;

    update_state(&app, |state| {
        let ws = state
            .workspaces
            .iter_mut()
            .find(|ws| ws.id == workspace_id)
            .ok_or_else(|| "Workspace not found".to_string())?;
        ws.name = name.clone();
        ws.updated_at_unix = now_unix();
        updated = Some(ws.clone());
        Ok(())
    })?;

    updated.ok_or_else(|| "Failed to rename workspace".to_string())
}

#[tauri::command]
pub fn delete_workspace(app: tauri::AppHandle, workspace_id: String) -> Result<(), String> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err("workspace_id is required".to_string());
    }

    update_state(&app, |state| {
        let target = state
            .workspaces
            .iter()
            .find(|ws| ws.id == workspace_id)
            .cloned()
            .ok_or_else(|| "Workspace not found".to_string())?;

        if target.workspace_type == WorkspaceType::Personal {
            let personal_count = state
                .workspaces
                .iter()
                .filter(|ws| ws.workspace_type == WorkspaceType::Personal)
                .count();
            if personal_count <= 1 {
                return Err("At least one personal workspace is required".to_string());
            }
        }

        state.workspaces.retain(|ws| ws.id != workspace_id);

        if state.current_workspace_id.as_deref() == Some(workspace_id) {
            state.current_workspace_id = state.workspaces.first().map(|ws| ws.id.clone());
        }
        Ok(())
    })?;

    Ok(())
}

#[tauri::command]
pub fn get_team_workspace_creation_path(plan_tier: String) -> TeamWorkspaceCreationPath {
    if is_paid_plan(&plan_tier) {
        TeamWorkspaceCreationPath {
            status: "allowed".to_string(),
            route: "/workspace/new/team".to_string(),
            message: "현재 플랜에서 팀 워크스페이스를 생성할 수 있습니다.".to_string(),
        }
    } else {
        TeamWorkspaceCreationPath {
            status: "upgrade_required".to_string(),
            route: "/billing/upgrade?target=team_workspace".to_string(),
            message: "팀 워크스페이스 생성을 위해 유료 플랜 업그레이드가 필요합니다.".to_string(),
        }
    }
}

#[tauri::command]
pub fn create_team_workspace(
    app: tauri::AppHandle,
    name: String,
    plan_tier: String,
    team_id: Option<i64>,
) -> Result<TeamWorkspaceCreationResult, String> {
    let name = validate_workspace_name(&name)?;
    let normalized_plan = normalize_plan(&plan_tier);

    let mut created: Option<Workspace> = None;
    update_state(&app, |state| {
        let now = now_unix();
        let resolved_team_id = team_id.unwrap_or_else(new_team_id);
        let workspace = Workspace {
            id: new_workspace_id(),
            name: name.clone(),
            workspace_type: WorkspaceType::Team,
            plan_tier: Some(normalized_plan.clone()),
            team_id: Some(resolved_team_id),
            created_at_unix: now,
            updated_at_unix: now,
        };
        state.current_workspace_id = Some(workspace.id.clone());
        state.workspaces.push(workspace.clone());
        created = Some(workspace);
        Ok(())
    })?;

    Ok(TeamWorkspaceCreationResult {
        status: "created".to_string(),
        message: "팀 워크스페이스가 생성되었습니다.".to_string(),
        route: "/workspace".to_string(),
        workspace: created,
    })
}
