/// Win32 Desktop Attachment — 바탕화면 위젯 (항상 최하위 Z-order)

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

#[cfg(target_os = "windows")]
static IS_DESKTOP_MODE: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "windows")]
static ORIGINAL_EXSTYLE: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static KEEP_BOTTOM: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, COLORREF};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;

/// 바탕화면에 고정 (항상 최하위 Z-order, 작업표시줄/Alt+Tab 숨김)
#[cfg(target_os = "windows")]
pub fn attach_to_desktop(hwnd: isize) {
    if IS_DESKTOP_MODE.load(Ordering::SeqCst) {
        return;
    }

    unsafe {
        let our = HWND(hwnd as *mut _);

        // 원래 스타일 저장
        ORIGINAL_EXSTYLE.store(
            GetWindowLongA(our, GWL_EXSTYLE) as isize,
            Ordering::SeqCst,
        );

        // 스타일 변경: 작업표시줄/Alt+Tab에서 숨김
        let ex = GetWindowLongA(our, GWL_EXSTYLE);
        let new_ex = (ex & !(WS_EX_APPWINDOW.0 as i32)) | (WS_EX_TOOLWINDOW.0 as i32);
        SetWindowLongA(our, GWL_EXSTYLE, new_ex);

        // Z-order 맨 아래로
        let _ = SetWindowPos(
            our,
            HWND_BOTTOM,
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );

        IS_DESKTOP_MODE.store(true, Ordering::SeqCst);
        KEEP_BOTTOM.store(true, Ordering::SeqCst);

        // 백그라운드 스레드: 항상 최하위 Z-order 유지
        std::thread::spawn(move || {
            while KEEP_BOTTOM.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if KEEP_BOTTOM.load(Ordering::SeqCst) {
                    let w = HWND(hwnd as *mut _);
                    let _ = SetWindowPos(
                        w,
                        HWND_BOTTOM,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
            }
        });
    }
}

/// 바탕화면 고정 해제
#[cfg(target_os = "windows")]
pub fn detach_from_desktop(hwnd: isize) {
    if !IS_DESKTOP_MODE.load(Ordering::SeqCst) {
        return;
    }

    // 백그라운드 스레드 중지
    KEEP_BOTTOM.store(false, Ordering::SeqCst);

    unsafe {
        let our = HWND(hwnd as *mut _);

        // 스타일 복원
        let saved = ORIGINAL_EXSTYLE.load(Ordering::SeqCst) as i32;
        if saved != 0 {
            SetWindowLongA(our, GWL_EXSTYLE, saved);
        } else {
            let ex = GetWindowLongA(our, GWL_EXSTYLE);
            let new_ex = (ex | (WS_EX_APPWINDOW.0 as i32)) & !(WS_EX_TOOLWINDOW.0 as i32);
            SetWindowLongA(our, GWL_EXSTYLE, new_ex);
        }

        // 일반 Z-order로 복원
        let _ = SetWindowPos(
            our,
            HWND_NOTOPMOST,
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
        );

        IS_DESKTOP_MODE.store(false, Ordering::SeqCst);
    }
}

// ── Tauri Commands ──────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn toggle_desktop_mode(window: tauri::Window) -> bool {
    if let Ok(hwnd) = window.hwnd() {
        let h = hwnd.0 as isize;
        if IS_DESKTOP_MODE.load(Ordering::SeqCst) {
            detach_from_desktop(h);
        } else {
            attach_to_desktop(h);
        }
    }
    IS_DESKTOP_MODE.load(Ordering::SeqCst)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn is_desktop_mode() -> bool {
    IS_DESKTOP_MODE.load(Ordering::SeqCst)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_desktop_mode(window: tauri::Window, enabled: bool) -> bool {
    if let Ok(hwnd) = window.hwnd() {
        let h = hwnd.0 as isize;
        let cur = IS_DESKTOP_MODE.load(Ordering::SeqCst);
        if enabled && !cur { attach_to_desktop(h); }
        else if !enabled && cur { detach_from_desktop(h); }
    }
    IS_DESKTOP_MODE.load(Ordering::SeqCst)
}

/// 윈도우 투명도 설정 (0.0 = 완전 투명, 1.0 = 불투명)
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_window_opacity(window: tauri::Window, opacity: f64) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let our = HWND(hwnd.0 as *mut _);
            // WS_EX_LAYERED 스타일 추가
            let ex = GetWindowLongA(our, GWL_EXSTYLE);
            if ex & (WS_EX_LAYERED.0 as i32) == 0 {
                SetWindowLongA(our, GWL_EXSTYLE, ex | WS_EX_LAYERED.0 as i32);
            }
            let alpha = (opacity.clamp(0.0, 1.0) * 255.0) as u8;
            let _ = SetLayeredWindowAttributes(our, COLORREF(0), alpha, LWA_ALPHA);
        }
    }
}

// ── Non-Windows stubs ───────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn toggle_desktop_mode(_window: tauri::Window) -> bool { false }

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn is_desktop_mode() -> bool { false }

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn set_desktop_mode(_window: tauri::Window, _enabled: bool) -> bool { false }

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn set_window_opacity(_window: tauri::Window, _opacity: f64) {}
