use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

/// OAuth 콜백 데이터
#[derive(Clone, serde::Serialize)]
pub struct OAuthCallback {
    pub provider: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub member_id: Option<String>,
    pub nickname: Option<String>,
    pub email: Option<String>,
    pub error: Option<String>,
}

/// 로컬 HTTP 서버를 시작하고 OAuth 콜백 URL을 반환
#[tauri::command]
pub async fn start_oauth_server(app: AppHandle) -> Result<u16, String> {
    // 사용 가능한 포트 찾기
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind to localhost: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    println!("🚀 OAuth 서버 시작: http://127.0.0.1:{}", port);

    // 서버 종료 플래그
    let should_stop = Arc::new(AtomicBool::new(false));
    let should_stop_clone = should_stop.clone();

    // 논블로킹 모드로 설정 (타임아웃 처리용)
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

    // 별도 스레드에서 콜백 대기
    std::thread::spawn(move || {
        let start_time = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(300); // 5분 타임아웃

        loop {
            // 타임아웃 체크
            if start_time.elapsed() > timeout {
                println!("⏰ OAuth 서버 타임아웃");
                break;
            }

            // 종료 플래그 체크
            if should_stop_clone.load(Ordering::Relaxed) {
                println!("🛑 OAuth 서버 종료 요청");
                break;
            }

            // 연결 시도
            match listener.accept() {
                Ok((mut stream, addr)) => {
                    println!("📥 연결 수신: {}", addr);

                    // 요청 읽기
                    let mut buffer = [0; 8192];
                    stream.set_nonblocking(false).ok();

                    if let Ok(n) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer[..n]);
                        println!("📄 요청:\n{}", request.lines().next().unwrap_or(""));

                        // 콜백 데이터 파싱
                        if let Some(callback) = parse_oauth_callback(&request) {
                            // 브라우저에 응답 전송
                            let response = create_html_response(&callback);
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.flush();

                            // 앱에 이벤트 전송
                            if let Err(e) = app.emit("oauth://callback", callback.clone()) {
                                println!("❌ 이벤트 전송 실패: {}", e);
                            } else {
                                println!("✅ OAuth 콜백 이벤트 전송 완료");
                            }

                            // 메인 윈도우 포커스
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.show();
                            }

                            // 성공적으로 처리됨, 서버 종료
                            break;
                        } else {
                            // 잘못된 요청 (favicon 등)
                            let response = "HTTP/1.1 404 Not Found\r\n\r\n";
                            let _ = stream.write_all(response.as_bytes());
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // 연결 없음, 잠시 대기 후 재시도
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => {
                    println!("❌ Accept 에러: {}", e);
                    break;
                }
            }
        }

        println!("🔚 OAuth 서버 종료");
    });

    Ok(port)
}

/// HTTP 요청에서 OAuth 콜백 파라미터 파싱
fn parse_oauth_callback(request: &str) -> Option<OAuthCallback> {
    // GET /callback?accessToken=...&refreshToken=... HTTP/1.1
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;

    // /callback 경로 확인
    if !path.starts_with("/callback") {
        return None;
    }

    // 쿼리 스트링 파싱
    let query = path.split('?').nth(1).unwrap_or("");

    let mut callback = OAuthCallback {
        provider: None,
        access_token: None,
        refresh_token: None,
        member_id: None,
        nickname: None,
        email: None,
        error: None,
    };

    for param in query.split('&') {
        let mut parts = param.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let value = parts
            .next()
            .map(|v| urlencoding::decode(v).unwrap_or_default().into_owned());

        match key {
            "provider" => callback.provider = value,
            "accessToken" => callback.access_token = value,
            "refreshToken" => callback.refresh_token = value,
            "memberId" => callback.member_id = value,
            "nickname" => callback.nickname = value,
            "email" => callback.email = value,
            "error" => callback.error = value,
            _ => {}
        }
    }

    // 에러가 있거나 토큰이 있으면 유효한 콜백
    if callback.error.is_some() || callback.access_token.is_some() {
        Some(callback)
    } else {
        None
    }
}

/// 브라우저에 표시할 HTML 응답 생성
fn create_html_response(callback: &OAuthCallback) -> String {
    let (title, message, color) = if callback.error.is_some() {
        (
            "로그인 실패",
            "로그인에 실패했습니다. 앱으로 돌아가 다시 시도해주세요.",
            "#ef4444",
        )
    } else {
        (
            "로그인 성공",
            "로그인이 완료되었습니다. 이 탭을 닫고 앱으로 돌아가세요.",
            "#22c55e",
        )
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        .card {{
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
            max-width: 400px;
        }}
        .icon {{
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: {};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
        }}
        .icon svg {{
            width: 40px;
            height: 40px;
            color: white;
        }}
        h1 {{
            color: #1f2937;
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }}
        p {{
            color: #6b7280;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        </div>
        <h1>{}</h1>
        <p>{}</p>
    </div>
    <script>
        // 3초 후 자동으로 탭 닫기 시도
        setTimeout(() => window.close(), 3000);
    </script>
</body>
</html>"#,
        title, color, title, message
    );

    format!(
        "HTTP/1.1 200 OK\r\n\
         Content-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        html.len(),
        html
    )
}
