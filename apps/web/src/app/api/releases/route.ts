import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateRelease, getLatestRelease } from "@/lib/release";

export async function POST(request: NextRequest) {
    try {
        // Authorization 헤더 검증
        const authHeader = request.headers.get("Authorization");
        const apiSecretKey = process.env.API_SECRET_KEY;

        if (!authHeader || authHeader !== `Bearer ${apiSecretKey}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            version,
            platform,
            fileName,
            downloadUrl,
            fileSize,
            checksum,
            releaseNotes,
            isPrerelease,
        } = body;

        // 필수 필드 검증
        if (!version || !platform || !fileName || !downloadUrl) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // lib/release.ts의 함수 사용
        const result = await createOrUpdateRelease({
            version,
            platform,
            fileName,
            downloadUrl,
            fileSize: parseInt(fileSize),
            checksum,
            releaseNotes,
            isPrerelease,
        });

        console.log(`✅ Release saved: ${version} - ${platform}`);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("❌ Failed to save release:", error);
        return NextResponse.json(
            { error: "Failed to save release" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const platform = searchParams.get("platform");
        const currentVersion = searchParams.get("currentVersion");

        if (!platform) {
            return NextResponse.json(
                { error: "Platform is required" },
                { status: 400 }
            );
        }

        // lib/release.ts의 함수 사용
        const latestRelease = await getLatestRelease(platform);

        if (!latestRelease) {
            return NextResponse.json({
                updateAvailable: false,
            });
        }

        // 버전 비교
        const isNewerVersion = currentVersion
            ? compareVersions(latestRelease.version, currentVersion) > 0
            : true;

        return NextResponse.json({
            updateAvailable: isNewerVersion,
            latestVersion: latestRelease.version,
            downloadUrl: latestRelease.download_url,
            fileSize: latestRelease.file_size,
            checksum: latestRelease.checksum,
            releaseNotes: latestRelease.release_notes,
        });
    } catch (error) {
        console.error("❌ Failed to fetch release:", error);
        return NextResponse.json(
            { error: "Failed to fetch release" },
            { status: 500 }
        );
    }
}

function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}
