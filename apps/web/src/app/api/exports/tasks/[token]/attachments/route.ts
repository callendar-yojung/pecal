import { NextRequest, NextResponse } from "next/server";
import { requireExportAccessByToken } from "@/lib/access";
import { getTaskAttachments } from "@/lib/task-attachment";
import { formatBytes } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await requireExportAccessByToken(request, token);
  if (access instanceof NextResponse) return access;
  const { exportRecord } = access;

  const attachments = await getTaskAttachments(exportRecord.task_id);
  const formattedAttachments = attachments.map((att) => ({
    ...att,
    file_size_formatted: formatBytes(att.file_size),
  }));

  return NextResponse.json({ attachments: formattedAttachments });
}
