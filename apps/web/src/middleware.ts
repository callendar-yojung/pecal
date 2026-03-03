import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const LOCALE_COOKIE = "NEXT_LOCALE";

function hasLocalePrefix(pathname: string) {
  return /^\/(ko|en)(\/|$)/.test(pathname);
}

function detectCountryCode(request: NextRequest) {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");
  return country?.toUpperCase() ?? null;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리자 페이지는 i18n 미들웨어 제외
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // API 라우트에 CORS 헤더 추가
  if (pathname.startsWith("/api")) {
    // 환경별 Origin 설정
    const origin =
      process.env.NODE_ENV === "production"
        ? "https://pecal.site"
        : "http://localhost:1420";

    // OPTIONS 요청 처리 (preflight)
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // 다른 요청에도 CORS 헤더 추가
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
  }

  // 첫 방문에 한해, 한국이 아닌 국가에서 접속하면 영어 로케일로 유도
  const hasLocaleCookie = Boolean(request.cookies.get(LOCALE_COOKIE)?.value);
  const countryCode = detectCountryCode(request);
  if (
    !hasLocaleCookie &&
    !hasLocalePrefix(pathname) &&
    countryCode &&
    countryCode !== "KR"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, "en", { path: "/" });
    return response;
  }

  // API가 아닌 경우 i18n 미들웨어 실행
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(ko|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
