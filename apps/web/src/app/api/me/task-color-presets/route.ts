import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  getMemberTaskColorPresets,
  upsertMemberTaskColorPresets,
} from "@/lib/member-settings";

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const hex3 = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const [r, g, b] = hex3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const hex6 = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) return `#${hex6[1].toUpperCase()}`;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const presets = await getMemberTaskColorPresets(user.memberId);
    return NextResponse.json({ presets });
  } catch (error) {
    console.error("Failed to fetch task color presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch task color presets" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const rawPresets = (body as { presets?: unknown }).presets;
    if (!Array.isArray(rawPresets)) {
      return NextResponse.json({ error: "presets must be an array" }, { status: 400 });
    }

    const normalized = rawPresets
      .map((item) => normalizeHex(item))
      .filter((item): item is string => Boolean(item));

    const deduped: string[] = [];
    for (const item of normalized) {
      if (!deduped.includes(item)) deduped.push(item);
    }

    const saved = await upsertMemberTaskColorPresets(user.memberId, deduped);
    return NextResponse.json({ success: true, presets: saved });
  } catch (error) {
    console.error("Failed to update task color presets:", error);
    return NextResponse.json(
      { error: "Failed to update task color presets" },
      { status: 500 },
    );
  }
}

