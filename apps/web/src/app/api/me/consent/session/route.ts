import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

const ACCESS_TOKEN_COOKIE_NAME = "PECAL_ACCESS_TOKEN";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.type !== "access") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Failed to create consent session cookie:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
