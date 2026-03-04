import { type NextRequest, NextResponse } from "next/server";
import { requireTaskAccess } from "@/lib/access";
import { createTaskExport, type TaskExportVisibility } from "@/lib/task-export";

function getPublicWebOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  // 모바일/데스크톱에서 생성하는 공유 링크는 항상 공개 도메인 기준으로 고정한다.
  // (개발 서버 origin(0.0.0.0 등)이 링크에 섞이는 문제 방지)
  return "https://pecal.site";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskId = Number(id);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const access = await requireTaskAccess(request, taskId);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const body = await request.json();
  const visibility = body?.visibility as TaskExportVisibility;
  const expiresAt =
    typeof body?.expires_at === "string" ? body.expires_at : null;

  if (visibility !== "public" && visibility !== "restricted") {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const record = await createTaskExport({
    taskId,
    createdBy: user.memberId,
    visibility,
    expiresAt,
  });

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale === "ko" || cookieLocale === "en" ? cookieLocale : "en";
  const path = `/${locale}/export/tasks/${record.token}`;
  const url = `${getPublicWebOrigin(request)}${path}`;

  return NextResponse.json({ token: record.token, url, path });
}
