import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type OwnerType = "team" | "personal";

export interface StorageUsage {
  owner_type: OwnerType;
  owner_id: number;
  used_bytes: number;
  file_count: number;
  updated_at: Date;
}

export interface StorageLimitInfo {
  owner_type: OwnerType;
  owner_id: number;
  used_bytes: number;
  limit_bytes: number;
  file_count: number;
  max_file_size_bytes: number;
  plan_name: string;
}

// 바이트를 MB로 변환
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

// MB를 바이트로 변환
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

// 바이트를 사람이 읽기 쉬운 형식으로 변환
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * 저장소 사용량 조회
 */
export async function getStorageUsage(
  ownerType: OwnerType,
  ownerId: number
): Promise<StorageUsage | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM storage_usage WHERE owner_type = ? AND owner_id = ?`,
    [ownerType, ownerId]
  );
  return rows.length > 0 ? (rows[0] as StorageUsage) : null;
}

/**
 * 저장소 사용량 초기화
 */
export async function initializeStorageUsage(
  ownerType: OwnerType,
  ownerId: number
): Promise<void> {
  await pool.execute(
    `INSERT INTO storage_usage (owner_type, owner_id, used_bytes, file_count)
     VALUES (?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE owner_id = owner_id`,
    [ownerType, ownerId]
  );
}

/**
 * 저장소 사용량 증가 (파일 업로드 시)
 */
export async function increaseStorageUsage(
  ownerType: OwnerType,
  ownerId: number,
  bytes: number
): Promise<void> {
  await pool.execute(
    `INSERT INTO storage_usage (owner_type, owner_id, used_bytes, file_count)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       used_bytes = used_bytes + VALUES(used_bytes),
       file_count = file_count + 1`,
    [ownerType, ownerId, bytes]
  );
}

/**
 * 저장소 사용량 감소 (파일 삭제 시)
 */
export async function decreaseStorageUsage(
  ownerType: OwnerType,
  ownerId: number,
  bytes: number
): Promise<void> {
  await pool.execute(
    `UPDATE storage_usage
     SET used_bytes = GREATEST(0, used_bytes - ?),
         file_count = GREATEST(0, file_count - 1)
     WHERE owner_type = ? AND owner_id = ?`,
    [bytes, ownerType, ownerId]
  );
}

/**
 * 저장소 사용량 재계산 (파일 테이블에서 실제 사용량 계산)
 */
export async function recalculateStorageUsage(
  ownerType: OwnerType,
  ownerId: number
): Promise<StorageUsage> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(file_size), 0) as total_bytes, COUNT(*) as file_count
       FROM files WHERE owner_type = ? AND owner_id = ?`,
      [ownerType, ownerId]
    );

    const totalBytes = Number(rows[0]?.total_bytes || 0);
    const fileCount = Number(rows[0]?.file_count || 0);

    await connection.execute(
      `INSERT INTO storage_usage (owner_type, owner_id, used_bytes, file_count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         used_bytes = VALUES(used_bytes),
         file_count = VALUES(file_count)`,
      [ownerType, ownerId, totalBytes, fileCount]
    );

    await connection.commit();

    return {
      owner_type: ownerType,
      owner_id: ownerId,
      used_bytes: totalBytes,
      file_count: fileCount,
      updated_at: new Date(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 활성 구독의 플랜 정보 조회 (없으면 Basic 플랜 반환)
 */
export async function getActivePlanForOwner(
  ownerType: OwnerType,
  ownerId: number
): Promise<{
  plan_id: number;
  name: string;
  max_storage_mb: number;
  max_file_size_mb: number;
  max_members: number;
}> {
  // 활성 구독 조회
  const [subscriptions] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*, p.name, p.max_storage_mb, p.max_file_size_mb, p.max_members
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.plan_id
     WHERE s.owner_type = ? AND s.owner_id = ? AND s.status = 'ACTIVE'
     ORDER BY s.started_at DESC
     LIMIT 1`,
    [ownerType, ownerId]
  );

  if (subscriptions.length > 0) {
    return {
      plan_id: subscriptions[0].plan_id,
      name: subscriptions[0].name,
      max_storage_mb: subscriptions[0].max_storage_mb,
      max_file_size_mb: subscriptions[0].max_file_size_mb,
      max_members: subscriptions[0].max_members,
    };
  }

  const fallbackType = ownerType === "team" ? "team" : "personal";
  const [fallbackPlans] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM plans WHERE plan_type = ? ORDER BY price ASC LIMIT 1`,
    [fallbackType]
  );

  if (fallbackPlans.length > 0) {
    return {
      plan_id: fallbackPlans[0].plan_id,
      name: fallbackPlans[0].name,
      max_storage_mb: fallbackPlans[0].max_storage_mb,
      max_file_size_mb: fallbackPlans[0].max_file_size_mb,
      max_members: fallbackPlans[0].max_members,
    };
  }

  // Basic 플랜도 없으면 기본값
  return {
    plan_id: 0,
    name: "Basic",
    max_storage_mb: 500,
    max_file_size_mb: 5,
    max_members: 1,
  };
}

/**
 * 저장소 한도 정보 조회 (현재 사용량 + 플랜 한도)
 */
export async function getStorageLimitInfo(
  ownerType: OwnerType,
  ownerId: number
): Promise<StorageLimitInfo> {
  const plan = await getActivePlanForOwner(ownerType, ownerId);
  const usage = await getStorageUsage(ownerType, ownerId);

  return {
    owner_type: ownerType,
    owner_id: ownerId,
    used_bytes: usage?.used_bytes || 0,
    limit_bytes: mbToBytes(plan.max_storage_mb),
    file_count: usage?.file_count || 0,
    max_file_size_bytes: mbToBytes(plan.max_file_size_mb),
    plan_name: plan.name,
  };
}

/**
 * 파일 업로드 가능 여부 확인
 */
export async function canUploadFile(
  ownerType: OwnerType,
  ownerId: number,
  fileSizeBytes: number
): Promise<{
  allowed: boolean;
  reason?: string;
  used_bytes: number;
  limit_bytes: number;
  max_file_size_bytes: number;
}> {
  const limitInfo = await getStorageLimitInfo(ownerType, ownerId);

  // 단일 파일 크기 체크
  if (fileSizeBytes > limitInfo.max_file_size_bytes) {
    return {
      allowed: false,
      reason: `파일 크기가 최대 허용 크기(${bytesToMB(limitInfo.max_file_size_bytes)}MB)를 초과합니다.`,
      used_bytes: limitInfo.used_bytes,
      limit_bytes: limitInfo.limit_bytes,
      max_file_size_bytes: limitInfo.max_file_size_bytes,
    };
  }

  // 총 저장소 용량 체크
  if (limitInfo.used_bytes + fileSizeBytes > limitInfo.limit_bytes) {
    return {
      allowed: false,
      reason: `저장소 용량이 부족합니다. 현재 ${bytesToMB(limitInfo.used_bytes).toFixed(1)}MB / ${bytesToMB(limitInfo.limit_bytes)}MB 사용 중`,
      used_bytes: limitInfo.used_bytes,
      limit_bytes: limitInfo.limit_bytes,
      max_file_size_bytes: limitInfo.max_file_size_bytes,
    };
  }

  return {
    allowed: true,
    used_bytes: limitInfo.used_bytes,
    limit_bytes: limitInfo.limit_bytes,
    max_file_size_bytes: limitInfo.max_file_size_bytes,
  };
}

/**
 * 저장소 사용량 삭제
 */
export async function deleteStorageUsage(
  ownerType: OwnerType,
  ownerId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM storage_usage WHERE owner_type = ? AND owner_id = ?`,
    [ownerType, ownerId]
  );
  return result.affectedRows > 0;
}

// ============================================
// 레거시 호환 함수들 (기존 API 호환용)
// ============================================

export interface TeamStorageUsage {
  team_id: number;
  used_storage_mb: number;
  updated_at: Date;
}

export async function getStorageUsageByTeamId(
  teamId: number
): Promise<TeamStorageUsage | null> {
  const usage = await getStorageUsage("team", teamId);
  if (!usage) return null;
  return {
    team_id: teamId,
    used_storage_mb: bytesToMB(usage.used_bytes),
    updated_at: usage.updated_at,
  };
}

export async function checkStorageLimit(
  teamId: number,
  additionalMb: number
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const result = await canUploadFile("team", teamId, mbToBytes(additionalMb));
  return {
    allowed: result.allowed,
    current: bytesToMB(result.used_bytes),
    limit: bytesToMB(result.limit_bytes),
  };
}

// 레거시 initializeStorageUsage (팀용)
export async function initializeStorageUsageForTeam(
  teamId: number
): Promise<void> {
  await initializeStorageUsage("team", teamId);
}

// 레거시 updateStorageUsage (팀용)
export async function updateStorageUsage(
  teamId: number,
  usedStorageMb: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE storage_usage
     SET used_bytes = ?
     WHERE owner_type = 'team' AND owner_id = ?`,
    [mbToBytes(usedStorageMb), teamId]
  );
  return result.affectedRows > 0;
}

// 레거시 recalculateStorageUsage (팀용, MB 반환)
export async function recalculateStorageUsageForTeam(
  teamId: number
): Promise<number> {
  const result = await recalculateStorageUsage("team", teamId);
  return bytesToMB(result.used_bytes);
}

// 레거시 deleteStorageUsage (팀용)
export async function deleteStorageUsageForTeam(
  teamId: number
): Promise<boolean> {
  return deleteStorageUsage("team", teamId);
}
