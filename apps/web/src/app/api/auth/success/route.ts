import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/success?access_token=XXX&refresh_token=YYY
 * 인증 성공 페이지 - 데스크톱 앱이 토큰을 받을 수 있도록 HTML 페이지 반환
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const memberId = searchParams.get("member_id");
  const nickname = searchParams.get("nickname");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
  <head>
    <title>인증 실패</title>
    <meta charset="utf-8">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        background: #f5f5f5;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        text-align: center;
        max-width: 400px;
      }
      .error {
        color: #e53e3e;
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="error">❌ 인증 실패</h1>
      <p>오류: ${error}</p>
      <p>이 창을 닫고 다시 시도해주세요.</p>
    </div>
  </body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }

  if (!accessToken || !refreshToken) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
  <head>
    <title>인증 오류</title>
    <meta charset="utf-8">
  </head>
  <body>
    <h1>토큰이 제공되지 않았습니다</h1>
  </body>
</html>`,
      {
        status: 400,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }

  // 데스크톱 앱이 토큰을 받을 수 있도록 HTML 페이지 반환
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head>
    <title>로그인 성공</title>
    <meta charset="utf-8">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        background: #f5f5f5;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        text-align: center;
        max-width: 500px;
      }
      .success {
        color: #38a169;
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }
      .token-info {
        background: #f7fafc;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
        word-break: break-all;
        font-size: 0.9rem;
        text-align: left;
      }
      .copy-btn {
        background: #4299e1;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin: 0.25rem;
      }
      .copy-btn:hover {
        background: #3182ce;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="success">✅ 로그인 성공!</h1>
      <p><strong>${nickname}</strong>님, 환영합니다!</p>
      
      <div class="token-info">
        <strong>Access Token:</strong>
        <div id="accessToken" style="margin-top: 0.5rem; font-family: monospace;">${accessToken}</div>
        <button class="copy-btn" onclick="copyToken('accessToken')">복사</button>
      </div>

      <div class="token-info">
        <strong>Refresh Token:</strong>
        <div id="refreshToken" style="margin-top: 0.5rem; font-family: monospace;">${refreshToken}</div>
        <button class="copy-btn" onclick="copyToken('refreshToken')">복사</button>
      </div>

      <p style="margin-top: 1rem; color: #718096; font-size: 0.9rem;">
        이 창을 닫고 앱으로 돌아가주세요.
      </p>
    </div>

    <script>
      // 데스크톱 앱으로 토큰 전달
      const authData = {
        accessToken: "${accessToken}",
        refreshToken: "${refreshToken}",
        memberId: ${memberId},
        nickname: "${nickname}"
      };

      // 데스크톱 앱이 이 데이터를 가져갈 수 있도록 전역 변수로 설정
      window.authData = authData;

      // postMessage로도 전달 (electron 등에서 사용 가능)
      if (window.opener) {
        window.opener.postMessage(authData, '*');
      }

      function copyToken(elementId) {
        const element = document.getElementById(elementId);
        const text = element.textContent;
        navigator.clipboard.writeText(text).then(() => {
          alert('토큰이 클립보드에 복사되었습니다!');
        });
      }

      // 3초 후 자동으로 창 닫기 시도 (선택적)
      // setTimeout(() => {
      //   window.close();
      // }, 3000);
    </script>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

