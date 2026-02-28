import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  deactivatePushTokenForMember,
  upsertMemberPushToken,
} from "@/lib/push-token";

function normalizePlatform(platform: unknown): "ios" | "android" | null {
  if (platform === "ios" || platform === "android") return platform;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      token?: string;
      platform?: string;
      device_id?: string;
      app_build?: string;
    };

    const token = body.token?.trim();
    const platform = normalizePlatform(body.platform);
    if (!token || !platform) {
      return NextResponse.json(
        { error: "token and platform are required" },
        { status: 400 },
      );
    }

    await upsertMemberPushToken({
      memberId: user.memberId,
      token,
      platform,
      deviceId: body.device_id?.trim() || null,
      appBuild: body.app_build?.trim() || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to upsert push token:", error);
    return NextResponse.json(
      { error: "Failed to register push token" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    await deactivatePushTokenForMember(user.memberId, token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete push token:", error);
    return NextResponse.json(
      { error: "Failed to unregister push token" },
      { status: 500 },
    );
  }
}
