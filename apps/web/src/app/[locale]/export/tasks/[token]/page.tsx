import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site-metadata";
import { getTaskByIdWithNames } from "@/lib/task";
import { getTaskExportByToken } from "@/lib/task-export";
import TaskExportViewClient from "./TaskExportViewClient";

type RichNode = {
  type?: string;
  text?: string;
  content?: RichNode[];
};

function extractTextFromRichNode(node: RichNode): string {
  const chunks: string[] = [];
  if (node.type === "text" && typeof node.text === "string") {
    chunks.push(node.text);
  }
  if (node.type === "hardBreak") {
    chunks.push(" ");
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      chunks.push(extractTextFromRichNode(child));
    }
    if (node.type === "paragraph") {
      chunks.push(" ");
    }
  }
  return chunks.join("");
}

function toPlainText(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as RichNode;
      const extracted = extractTextFromRichNode(parsed)
        .replace(/\s+/g, " ")
        .trim();
      if (extracted) return extracted;
    } catch {
      // fallback to html/text cleanup below
    }
  }
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  return normalized;
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale, token } = await params;
  const safeLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : "ko";

  const fallbackTitle =
    safeLocale === "ko" ? "Pecal 일정 공유" : "Pecal Task Share";
  const fallbackDescription =
    safeLocale === "ko"
      ? "Pecal에서 공유한 일정입니다."
      : "A task shared from Pecal.";

  let title = fallbackTitle;
  let description = fallbackDescription;

  const exportRecord = await getTaskExportByToken(token);
  if (exportRecord) {
    const isExpired =
      !!exportRecord.expires_at &&
      new Date(exportRecord.expires_at).getTime() <= Date.now();
    const isRevoked = !!exportRecord.revoked_at;
    if (exportRecord.visibility === "public" && !isExpired && !isRevoked) {
      const task = await getTaskByIdWithNames(exportRecord.task_id);
      if (task) {
        title = truncateText(task.title || fallbackTitle, 80);
        const contentPreview = truncateText(toPlainText(task.content), 160);
        description = contentPreview || fallbackDescription;
      }
    }
  }

  const pageUrl = `${SITE_URL}/${safeLocale}/export/tasks/${token}`;
  const imageUrl = `${SITE_URL}${DEFAULT_OG_IMAGE}`;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      url: pageUrl,
      siteName: "Pecal",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: safeLocale === "ko" ? "ko_KR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function TaskExportPage() {
  return <TaskExportViewClient />;
}
