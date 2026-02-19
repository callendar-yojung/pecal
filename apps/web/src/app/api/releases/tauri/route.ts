import { NextRequest, NextResponse } from "next/server";
import { getLatestRelease } from "@/lib/release";

function normalizeVersion(version?: string | null): string[] {
  if (!version) return [];
  return version
    .replace(/^v/i, "")
    .split(".")
    .map((part) => {
      const n = Number(part.replace(/[^\d].*$/, ""));
      return Number.isFinite(n) ? String(n) : "0";
    });
}

function compareVersions(a?: string | null, b?: string | null): number {
  const aParts = normalizeVersion(a);
  const bParts = normalizeVersion(b);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const av = Number(aParts[i] ?? "0");
    const bv = Number(bParts[i] ?? "0");
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function buildSigUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    url.pathname = `${url.pathname}.sig`;
    return url.toString();
  } catch {
    return `${downloadUrl}.sig`;
  }
}

function buildPlatformCandidates(target: string, arch?: string | null): string[] {
  const candidates = new Set<string>();
  const safeArch = arch?.trim();
  const baseTarget = target.split("-")[0];

  candidates.add(target);
  candidates.add(baseTarget);

  if (safeArch && !target.includes(safeArch)) {
    candidates.add(`${target}-${safeArch}`);
  }
  if (safeArch) {
    candidates.add(`${baseTarget}-${safeArch}`);
  }

  if (baseTarget === "darwin") {
    if (safeArch) {
      candidates.add(`macos-${safeArch}`);
    }
    candidates.add("macos");
  }

  if (baseTarget === "linux") {
    candidates.add("ubuntu");
  }

  return Array.from(candidates);
}

/**
 * Tauri updater dynamic endpoint
 * query:
 * - target: windows | linux | darwin
 * - arch: x86_64 | aarch64
 * - current_version: 1.2.3
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const target = (params.get("target") || "").toLowerCase();
    const arch = params.get("arch");
    const currentVersion = params.get("current_version");

    if (!target) {
      return NextResponse.json(
        { error: "target query is required" },
        { status: 400 }
      );
    }

    const candidates = buildPlatformCandidates(target, arch);
    let latestRelease: any = null;
    for (const platform of candidates) {
      latestRelease = await getLatestRelease(platform);
      if (latestRelease) break;
    }

    if (!latestRelease) {
      return new NextResponse(null, { status: 204 });
    }

    if (currentVersion && compareVersions(latestRelease.version, currentVersion) <= 0) {
      return new NextResponse(null, { status: 204 });
    }

    const sigUrl = buildSigUrl(latestRelease.download_url);
    const sigResponse = await fetch(sigUrl, { cache: "no-store" });
    if (!sigResponse.ok) {
      return NextResponse.json(
        { error: `signature fetch failed: ${sigResponse.status}` },
        { status: 500 }
      );
    }

    const signature = (await sigResponse.text()).trim();
    if (!signature) {
      return NextResponse.json(
        { error: "signature is empty" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      version: latestRelease.version,
      notes: latestRelease.release_notes || "",
      pub_date: new Date(latestRelease.created_at).toISOString(),
      url: latestRelease.download_url,
      signature,
    });
  } catch (error) {
    console.error("❌ Failed to fetch tauri updater release:", error);
    return NextResponse.json(
      { error: "Failed to fetch tauri updater release" },
      { status: 500 }
    );
  }
}
