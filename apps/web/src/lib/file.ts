import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { type OwnerType, increaseStorageUsage, decreaseStorageUsage } from "./storage";

export interface FileRecord {
  file_id: number;
  owner_type: OwnerType;
  owner_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number; // bytes
  mime_type: string | null;
  uploaded_by: number;
  created_at: Date;
}

export interface CreateFileData {
  owner_type: OwnerType;
  owner_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: number;
}

/**
 * 파일 레코드 생성
 */
export async function createFileRecord(data: CreateFileData): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 파일 레코드 생성
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO files (owner_type, owner_id, original_name, stored_name, file_path, file_size, mime_type, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.owner_type,
        data.owner_id,
        data.original_name,
        data.stored_name,
        data.file_path,
        data.file_size,
        data.mime_type || null,
        data.uploaded_by,
      ]
    );

    // 저장소 사용량 증가
    await increaseStorageUsage(data.owner_type, data.owner_id, data.file_size);

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 파일 ID로 조회
 */
export async function getFileById(fileId: number): Promise<FileRecord | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM files WHERE file_id = ?`,
    [fileId]
  );
  return rows.length > 0 ? (rows[0] as FileRecord) : null;
}

/**
 * 소유자별 파일 목록 조회
 */
export async function getFilesByOwner(
  ownerType: OwnerType,
  ownerId: number
): Promise<FileRecord[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM files WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC`,
    [ownerType, ownerId]
  );
  return rows as FileRecord[];
}

/**
 * 업로더별 파일 목록 조회
 */
export async function getFilesByUploader(uploadedBy: number): Promise<FileRecord[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM files WHERE uploaded_by = ? ORDER BY created_at DESC`,
    [uploadedBy]
  );
  return rows as FileRecord[];
}

/**
 * 파일 삭제
 */
export async function deleteFileRecord(fileId: number): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 파일 정보 가져오기
    const [fileRows] = await connection.execute<RowDataPacket[]>(
      `SELECT owner_type, owner_id, file_size FROM files WHERE file_id = ?`,
      [fileId]
    );

    if (fileRows.length === 0) {
      await connection.rollback();
      return false;
    }

    const file = fileRows[0];

    // 파일 삭제
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM files WHERE file_id = ?`,
      [fileId]
    );

    if (result.affectedRows > 0) {
      // 저장소 사용량 감소
      await decreaseStorageUsage(file.owner_type, file.owner_id, file.file_size);
    }

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 파일 이름 수정
 */
export async function updateFileName(
  fileId: number,
  originalName: string
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE files SET original_name = ? WHERE file_id = ?`,
    [originalName, fileId]
  );
  return result.affectedRows > 0;
}

/**
 * 소유자별 총 파일 크기 조회
 */
export async function getTotalFileSize(
  ownerType: OwnerType,
  ownerId: number
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(file_size), 0) as total_size
     FROM files
     WHERE owner_type = ? AND owner_id = ?`,
    [ownerType, ownerId]
  );
  return Number(rows[0]?.total_size || 0);
}

/**
 * 소유자별 파일 개수 조회
 */
export async function getFileCount(
  ownerType: OwnerType,
  ownerId: number
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM files WHERE owner_type = ? AND owner_id = ?`,
    [ownerType, ownerId]
  );
  return Number(rows[0]?.count || 0);
}

// ============================================
// 레거시 호환 함수들 (기존 API 호환용)
// ============================================

export interface File {
  id: number;
  team_id: number;
  file_name: string;
  file_size_mb: number;
  created_at: Date;
}

export async function getFilesByTeamId(teamId: number): Promise<File[]> {
  const files = await getFilesByOwner("team", teamId);
  return files.map((f) => ({
    id: f.file_id,
    team_id: f.owner_id,
    file_name: f.original_name,
    file_size_mb: f.file_size / (1024 * 1024),
    created_at: f.created_at,
  }));
}

export async function createFile(
  teamId: number,
  fileName: string,
  fileSizeMb: number
): Promise<number> {
  return createFileRecord({
    owner_type: "team",
    owner_id: teamId,
    original_name: fileName,
    stored_name: fileName,
    file_path: `/uploads/teams/${teamId}/${fileName}`,
    file_size: Math.round(fileSizeMb * 1024 * 1024),
    uploaded_by: 0, // 레거시 호환
  });
}

export async function updateFile(fileId: number, fileName: string): Promise<boolean> {
  return updateFileName(fileId, fileName);
}

export async function deleteFile(fileId: number): Promise<boolean> {
  return deleteFileRecord(fileId);
}

export async function getTotalFileSizeByTeamId(teamId: number): Promise<number> {
  const bytes = await getTotalFileSize("team", teamId);
  return bytes / (1024 * 1024); // MB로 변환
}
