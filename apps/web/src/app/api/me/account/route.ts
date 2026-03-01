import type { RowDataPacket } from "mysql2";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import pool from "@/lib/db";
import {
  isNicknameReserved,
  isNicknameTaken,
  updateMemberNickname,
  updateMemberProfileImage,
} from "@/lib/member";
import { getMemberConsents, upsertMemberConsents } from "@/lib/member-settings";
import { deleteFromS3, extractS3KeyFromUrl } from "@/lib/s3";

// GET /api/me/account - 현재 사용자 정보 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 정보 조회
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        member_id,
        provider,
        email,
        phone_number,
        nickname,
        profile_image_url,
        created_at,
        lasted_at
      FROM members
      WHERE member_id = ?`,
      [user.memberId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const consents = await getMemberConsents(user.memberId);
    return NextResponse.json({
      ...rows[0],
      ...consents,
    });
  } catch (error) {
    console.error("Failed to fetch account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 },
    );
  }
}

// PATCH /api/me/account - 닉네임 수정
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const allowedFields = [
      "nickname",
      "profile_image_url",
      "privacy_consent",
      "marketing_consent",
    ];
    const unsupportedFields = Object.keys(payload).filter(
      (key) => !allowedFields.includes(key),
    );
    if (unsupportedFields.length > 0) {
      return NextResponse.json(
        {
          error: `Unsupported field(s): ${unsupportedFields.join(", ")}`,
          supported: allowedFields,
        },
        { status: 400 },
      );
    }

    const { nickname, profile_image_url, privacy_consent, marketing_consent } = payload as {
      nickname?: unknown;
      profile_image_url?: unknown;
      privacy_consent?: unknown;
      marketing_consent?: unknown;
    };

    const hasNickname =
      typeof nickname === "string" && nickname.trim().length > 0;
    const hasProfileImage =
      typeof profile_image_url === "string" || profile_image_url === null;
    const hasPrivacyConsent = typeof privacy_consent === "boolean";
    const hasMarketingConsent = typeof marketing_consent === "boolean";

    if (
      !hasNickname &&
      !hasProfileImage &&
      !hasPrivacyConsent &&
      !hasMarketingConsent
    ) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    if (hasNickname) {
      const trimmed = (nickname as string).trim();
      if (trimmed.length > 200) {
        return NextResponse.json(
          { error: "Nickname must be 200 characters or less" },
          { status: 400 },
        );
      }
      if (isNicknameReserved(trimmed)) {
        return NextResponse.json(
          { error: "Nickname is reserved" },
          { status: 400 },
        );
      }
      const taken = await isNicknameTaken(trimmed, user.memberId);
      if (taken) {
        return NextResponse.json(
          { error: "Nickname already taken" },
          { status: 409 },
        );
      }
      await updateMemberNickname(user.memberId, trimmed);
    }

    if (hasProfileImage) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT profile_image_url FROM members WHERE member_id = ?",
        [user.memberId],
      );
      const currentProfileUrl =
        rows.length > 0
          ? (rows[0] as { profile_image_url: string | null }).profile_image_url
          : null;

      await updateMemberProfileImage(user.memberId, profile_image_url);

      if (currentProfileUrl && currentProfileUrl !== profile_image_url) {
        const key = extractS3KeyFromUrl(currentProfileUrl);
        if (key) {
          await deleteFromS3(key);
        }
      }
    }

    if (hasPrivacyConsent || hasMarketingConsent) {
      await upsertMemberConsents(user.memberId, {
        privacy_consent: hasPrivacyConsent
          ? (privacy_consent as boolean)
          : undefined,
        marketing_consent: hasMarketingConsent
          ? (marketing_consent as boolean)
          : undefined,
      });
    }

    const consents = await getMemberConsents(user.memberId);

    return NextResponse.json({
      success: true,
      nickname: hasNickname ? (nickname as string).trim() : undefined,
      profile_image_url: hasProfileImage ? profile_image_url : undefined,
      ...consents,
    });
  } catch (error) {
    console.error("Failed to update account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 },
    );
  }
}
