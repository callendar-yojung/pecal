import pool from "./db";

interface ReleaseData {
  version: string;
  platform: string;
  fileName: string;
  downloadUrl: string;
  fileSize: number;
  checksum: string;
  releaseNotes?: string;
  isPrerelease?: boolean;
}

export async function createOrUpdateRelease(data: ReleaseData) {
  const {
    version,
    platform,
    fileName,
    downloadUrl,
    fileSize,
    checksum,
    releaseNotes = "",
    isPrerelease = false,
  } = data;

  try {
    const [result] = await pool.execute(
      `INSERT INTO releases 
       (version, platform, file_name, download_url, file_size, 
        checksum, release_notes, is_prerelease, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
       download_url = VALUES(download_url),
       file_size = VALUES(file_size),
       checksum = VALUES(checksum),
       release_notes = VALUES(release_notes),
       updated_at = NOW()`,
      [version, platform, fileName, downloadUrl, fileSize, checksum, releaseNotes, isPrerelease]
    );

    return {
      success: true,
      insertId: (result as any).insertId,
    };
  } catch (error) {
    console.error("❌ Failed to save release:", error);
    throw error;
  }
}

export async function getLatestRelease(platform: string) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM releases
       WHERE platform = ? AND is_prerelease = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [platform]
    );

    return (rows as any[])[0] || null;
  } catch (error) {
    console.error("❌ Failed to get latest release:", error);
    throw error;
  }
}

export async function getAllLatestReleases() {
  try {
    // 각 플랫폼별 최신 릴리즈를 가져옴
    const [rows] = await pool.execute(
      `SELECT r1.* FROM releases r1
       INNER JOIN (
         SELECT platform, MAX(created_at) as max_created
         FROM releases
         WHERE is_prerelease = false
         GROUP BY platform
       ) r2 ON r1.platform = r2.platform AND r1.created_at = r2.max_created
       WHERE r1.is_prerelease = false`
    );

    const releases = rows as any[];

    // 플랫폼별로 정리
    const result: Record<string, any> = {};
    for (const release of releases) {
      result[release.platform] = {
        version: release.version,
        downloadUrl: release.download_url,
        fileName: release.file_name,
        fileSize: release.file_size,
        checksum: release.checksum,
        releaseNotes: release.release_notes,
        createdAt: release.created_at,
      };
    }

    return result;
  } catch (error) {
    console.error("❌ Failed to get all latest releases:", error);
    throw error;
  }
}
