mod account;
mod alarm;
mod desktop_attach;
mod oauth;
mod position;
mod workspace;

#[cfg(target_os = "windows")]
mod autostart;

use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // ── Tauri commands ──────────────────────────────────────────────
    #[cfg(target_os = "windows")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            position::save_window_position,
            position::save_window_size,
            position::save_window_opacity,
            position::get_window_opacity,
            autostart::set_autostart,
            autostart::get_autostart,
            oauth::start_oauth_server,
            account::get_account_settings,
            account::set_reserved_nicknames,
            account::is_nickname_available,
            account::update_nickname,
            account::upload_profile_image,
            account::delete_profile_image,
            account::get_user_preferences,
            account::save_user_preferences,
            account::get_auth_session,
            account::save_auth_session,
            account::clear_auth_session,
            account::logout,
            alarm::set_alarm_notifications_enabled,
            alarm::get_alarm_manager_state,
            alarm::clear_workspace_task_alarms,
            alarm::sync_task_alarms,
            alarm::snooze_alarm,
            alarm::dismiss_alarm,
            workspace::get_workspace_state,
            workspace::list_personal_workspaces,
            workspace::list_team_workspaces,
            workspace::get_current_workspace,
            workspace::switch_workspace,
            workspace::create_workspace,
            workspace::rename_workspace,
            workspace::delete_workspace,
            workspace::get_team_workspace_creation_path,
            workspace::create_team_workspace,
            desktop_attach::toggle_desktop_mode,
            desktop_attach::is_desktop_mode,
            desktop_attach::set_desktop_mode,
            desktop_attach::set_window_opacity,
        ]);
    }

    #[cfg(not(target_os = "windows"))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            position::save_window_position,
            position::save_window_size,
            position::save_window_opacity,
            position::get_window_opacity,
            oauth::start_oauth_server,
            account::get_account_settings,
            account::set_reserved_nicknames,
            account::is_nickname_available,
            account::update_nickname,
            account::upload_profile_image,
            account::delete_profile_image,
            account::get_user_preferences,
            account::save_user_preferences,
            account::get_auth_session,
            account::save_auth_session,
            account::clear_auth_session,
            account::logout,
            alarm::set_alarm_notifications_enabled,
            alarm::get_alarm_manager_state,
            alarm::clear_workspace_task_alarms,
            alarm::sync_task_alarms,
            alarm::snooze_alarm,
            alarm::dismiss_alarm,
            workspace::get_workspace_state,
            workspace::list_personal_workspaces,
            workspace::list_team_workspaces,
            workspace::get_current_workspace,
            workspace::switch_workspace,
            workspace::create_workspace,
            workspace::rename_workspace,
            workspace::delete_workspace,
            workspace::get_team_workspace_creation_path,
            workspace::create_team_workspace,
            desktop_attach::toggle_desktop_mode,
            desktop_attach::is_desktop_mode,
            desktop_attach::set_desktop_mode,
            desktop_attach::set_window_opacity,
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL: Desktop에서 single-instance를 반드시 먼저 등록해야 함
    // 목적: 브라우저 로그인 후 Deep link로 돌아올 때 새 창을 열지 않기
    // Windows에서 두 번째 인스턴스가 실행될 때:
    //   1. Mutex로 기존 인스턴스 감지
    //   2. 명령줄 인자(deep link URL 포함)를 기존 인스턴스로 IPC 전송
    //   3. 두 번째 인스턴스는 창 없이 즉시 종료 (매우 중요!)
    // ═══════════════════════════════════════════════════════════════════
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("═══════════════════════════════════════════════════════════");
            println!("🔁 SINGLE INSTANCE: 두 번째 인스턴스 감지!");
            println!("   argv: {:?}", argv);
            println!("═══════════════════════════════════════════════════════════");

            // Windows/Linux에서 deep link URL은 argv에 포함됨
            // argv = ["C:\path\app.exe", "deskcal://auth/callback?token=..."]
            for arg in argv.iter() {
                if arg.starts_with("deskcal://") || arg.starts_with("deskcal-dev://") {
                    println!("🔗 Deep link URL 발견: {}", arg);

                    // 프론트엔드가 준비될 때까지 짧은 딜레이
                    let handle = app.clone();
                    let url = arg.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        // 기존 인스턴스의 프론트엔드로 이벤트 전송
                        if let Err(e) = handle.emit("deep-link://new-url", url) {
                            eprintln!("❌ Deep link emit 실패: {}", e);
                        } else {
                            println!("✅ Deep link 이벤트 전송 완료");
                        }
                    });
                }
            }

            // 기존 윈도우를 포커스
            if let Some(window) = app.get_webview_window("main") {
                println!("🪟 기존 윈도우 포커스...");
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let alarm_state = alarm::load_alarm_manager(app.handle());
            app.manage(std::sync::Mutex::new(alarm_state));

            // Logging
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Debug)
                    .build(),
            )?;

            // ═══════════════════════════════════════════════════════════
            // 개발 모드 또는 Windows에서 deep link 스킴 등록
            // 이렇게 해야 개발 중에도 deep link 테스트 가능
            // ═══════════════════════════════════════════════════════════
            #[cfg(any(target_os = "linux", target_os = "macos", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                println!("📝 Deep link 스킴 등록 중...");
                if let Err(e) = app.deep_link().register_all() {
                    eprintln!("❌ Deep link 등록 실패: {}", e);
                } else {
                    println!("✅ Deep link 스킴 등록 완료");
                }
            }

            let handle = app.handle().clone();

            // ═══════════════════════════════════════════════════════════
            // Deep Link handler
            // - macOS/iOS/Android: OS가 URL을 기존 인스턴스로 라우팅
            // - Windows/Linux: single-instance 플러그인이 처리
            // ═══════════════════════════════════════════════════════════
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    let url_str = url.to_string();
                    println!("🔗 Deep link 수신 (on_open_url): {}", url_str);

                    if let Err(e) = handle.emit("deep-link://new-url", url_str) {
                        eprintln!("❌ Deep link emit 실패: {}", e);
                    }
                }
            });

            // ── Restore window state (position + size) ──────────────────
            position::restore_state(app.handle());

            // ── Restore opacity (Windows) ────────────────────────────────
            #[cfg(target_os = "windows")]
            {
                if let Some(state) = position::load_state(app.handle()) {
                    if state.opacity < 100.0 {
                        if let Some(window) = app.handle().get_webview_window("main") {
                            if let Ok(hwnd) = window.hwnd() {
                                let h = hwnd.0 as isize;
                                unsafe {
                                    use windows::Win32::Foundation::{COLORREF, HWND};
                                    use windows::Win32::UI::WindowsAndMessaging::*;
                                    let our = HWND(h as *mut _);
                                    let ex = GetWindowLongA(our, GWL_EXSTYLE);
                                    if ex & (WS_EX_LAYERED.0 as i32) == 0 {
                                        SetWindowLongA(
                                            our,
                                            GWL_EXSTYLE,
                                            ex | WS_EX_LAYERED.0 as i32,
                                        );
                                    }
                                    let alpha =
                                        ((state.opacity / 100.0).clamp(0.0, 1.0) * 255.0) as u8;
                                    let _ = SetLayeredWindowAttributes(
                                        our,
                                        COLORREF(0),
                                        alpha,
                                        LWA_ALPHA,
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // ── Windows-only: desktop attach + autostart + deep link ───
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.handle().get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        desktop_attach::attach_to_desktop(hwnd.0 as isize);
                    }
                }
                autostart::enable_autostart();
                autostart::register_deep_link_scheme();
            }

            // ── Save position / size on window move or resize ─────────
            if let Some(window) = app.handle().get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::Moved(pos) => {
                        position::save_position(&app_handle, pos.x as f64, pos.y as f64);
                    }
                    tauri::WindowEvent::Resized(size) => {
                        position::save_size(&app_handle, size.width as f64, size.height as f64);
                    }
                    _ => {}
                });
            }

            // ═══════════════════════════════════════════════════════════
            // 첫 번째 인스턴스가 deep link로 시작된 경우 처리
            // (앱이 실행 중이지 않을 때 deep link 클릭)
            // ═══════════════════════════════════════════════════════════
            let args: Vec<String> = std::env::args().collect();
            println!("🚀 앱 시작 인자: {:?}", args);

            for arg in args.iter().skip(1) {
                if arg.starts_with("deskcal://") || arg.starts_with("deskcal-dev://") {
                    println!("🔗 시작 인자에서 deep link 발견: {}", arg);
                    let handle = app.handle().clone();
                    let url = arg.clone();

                    // 프론트엔드가 준비될 때까지 대기
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        println!("🔗 시작 deep link 전송: {}", url);
                        if let Err(e) = handle.emit("deep-link://new-url", url) {
                            eprintln!("❌ 시작 deep link emit 실패: {}", e);
                        }
                    });
                }
            }

            alarm::start_alarm_scheduler(app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
