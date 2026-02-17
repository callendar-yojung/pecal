import { NextResponse } from "next/server";
import { getAllLatestReleases } from "@/lib/release";

/**
 * GET /api/releases/latest
 * 모든 플랫폼의 최신 릴리즈 정보를 반환합니다.
 */
export async function GET() {
  try {
    const releases = await getAllLatestReleases();

    return NextResponse.json({
      success: true,
      releases,
    });
  } catch (error) {
    console.error("❌ Failed to fetch releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}