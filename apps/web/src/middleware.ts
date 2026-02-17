import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리자 페이지는 i18n 미들웨어 제외
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // API 라우트에 CORS 헤더 추가
  if (pathname.startsWith("/api")) {
    // 환경별 Origin 설정
    const origin = process.env.NODE_ENV === "production"
        ? "https://trabien.com"
        : "http://localhost:1420";

    // OPTIONS 요청 처리 (preflight)
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // 다른 요청에도 CORS 헤더 추가
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
  }

  // API가 아닌 경우 i18n 미들웨어 실행
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(ko|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
