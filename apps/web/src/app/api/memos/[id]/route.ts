import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess } from "@/lib/access";
import {
  deleteMemo,
  getMemoById,
  updateMemo,
  type MemoOwnerType,
} from "@/lib/memo";

function parseOwnerType(value: string | null): MemoOwnerType | null {
  if (value === "personal" || value === "team") return value;
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memoId = Number(id);
  const ownerType = parseOwnerType(request.nextUrl.searchParams.get("owner_type"));
  const ownerId = Number(request.nextUrl.searchParams.get("owner_id"));

  if (Number.isNaN(memoId) || !ownerType || Number.isNaN(ownerId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const access = await requireOwnerAccess(request, ownerType, ownerId);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const memo = await getMemoById(memoId, ownerType, ownerId, user.memberId);
  return NextResponse.json({ memo });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memoId = Number(id);
  const body = await request.json();
  const ownerType = parseOwnerType(body?.owner_type ?? null);
  const ownerId = Number(body?.owner_id);
  const title = typeof body?.title === "string" ? body.title.trim() : null;
  const content = body?.content;
  const isFavorite =
    typeof body?.is_favorite === "boolean" ? body.is_favorite : null;

  if (Number.isNaN(memoId) || !ownerType || Number.isNaN(ownerId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const access = await requireOwnerAccess(request, ownerType, ownerId);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const success = await updateMemo(memoId, ownerType, ownerId, user.memberId, {
    title: title ?? undefined,
    contentJson: content ? JSON.stringify(content) : undefined,
    isFavorite: isFavorite ?? undefined,
  });

  return NextResponse.json({ success });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memoId = Number(id);
  const ownerType = parseOwnerType(request.nextUrl.searchParams.get("owner_type"));
  const ownerId = Number(request.nextUrl.searchParams.get("owner_id"));

  if (Number.isNaN(memoId) || !ownerType || Number.isNaN(ownerId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const access = await requireOwnerAccess(request, ownerType, ownerId);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const success = await deleteMemo(memoId, ownerType, ownerId, user.memberId);
  return NextResponse.json({ success });
}
