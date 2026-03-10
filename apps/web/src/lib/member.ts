import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "./db";

export interface Member {
  member_id: number;
  provider: string | null;
  provider_id: string | null;
  login_id?: string | null;
  password_hash?: string | null;
  created_at: Date | null;
  lasted_at: Date | null;
  email: string | null;
  phone_number: string | null;
  nickname: string | null;
  profile_image_url?: string | null;
}

let ensureMemberLocalAuthSchemaPromise: Promise<void> | null = null;

function isDuplicateEntryError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === "ER_DUP_ENTRY"
  );
}

async function execIgnoreDuplicate(sql: string) {
  try {
    await pool.execute(sql);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate column name")) {
      return;
    }
    if (error instanceof Error && error.message.includes("Duplicate key name")) {
      return;
    }
    throw error;
  }
}

export async function ensureMemberLocalAuthSchema() {
  if (!ensureMemberLocalAuthSchemaPromise) {
    ensureMemberLocalAuthSchemaPromise = (async () => {
      await execIgnoreDuplicate(
        "ALTER TABLE members ADD COLUMN login_id VARCHAR(64) NULL AFTER provider_id",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE members ADD COLUMN password_hash VARCHAR(255) NULL AFTER login_id",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE members ADD UNIQUE KEY ux_members_login_id (login_id)",
      );
    })();
  }

  await ensureMemberLocalAuthSchemaPromise;
}

export function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

export function isValidLoginId(loginId: string) {
  return /^[a-z0-9][a-z0-9._-]{3,31}$/.test(normalizeLoginId(loginId));
}

export function isValidMemberPassword(password: string) {
  return password.length >= 8 && /[^A-Za-z0-9]/.test(password);
}

export function isValidMemberEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function generateRandomNickname(locale: "ko" | "en"): string {
  const koAdjectives = [
    "행복한",
    "즐거운",
    "신나는",
    "귀여운",
    "멋진",
    "활발한",
    "용감한",
    "친절한",
    "빠른",
    "똑똑한",
    "따뜻한",
    "차분한",
    "유쾌한",
    "빛나는",
    "성실한",
    "포근한",
    "당당한",
    "날렵한",
    "정직한",
    "상냥한",
  ];
  const koNouns = [
    "고양이",
    "강아지",
    "토끼",
    "판다",
    "호랑이",
    "사자",
    "여우",
    "곰",
    "펭귄",
    "코알라",
    "독수리",
    "다람쥐",
    "고래",
    "돌고래",
    "사슴",
    "부엉이",
    "햄스터",
    "라쿤",
    "늑대",
    "수달",
  ];
  const enAdjectives = [
    "Bright",
    "Happy",
    "Swift",
    "Brave",
    "Kind",
    "Calm",
    "Clever",
    "Gentle",
    "Bold",
    "Witty",
    "Sunny",
    "Mighty",
    "Lucky",
    "Charming",
    "Nimble",
    "Curious",
    "Quiet",
    "Fierce",
    "Glowing",
    "Warm",
  ];
  const enNouns = [
    "Fox",
    "Otter",
    "Tiger",
    "Panda",
    "Falcon",
    "Wolf",
    "Bear",
    "Rabbit",
    "Dolphin",
    "Hawk",
    "Lion",
    "Koala",
    "Penguin",
    "Sparrow",
    "Owl",
    "Deer",
    "Whale",
    "Lynx",
    "Raccoon",
    "Hedgehog",
  ];

  const isKo = locale === "ko";
  const adjectives = isKo ? koAdjectives : enAdjectives;
  const nouns = isKo ? koNouns : enNouns;
  const randomNum = Math.floor(Math.random() * 1000000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}${noun}${randomNum}`;
}

export async function findMemberByProvider(
  provider: string,
  providerId: string,
): Promise<Member | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM members WHERE provider = ? AND provider_id = ?",
    [provider, providerId],
  );
  return (rows[0] as Member) || null;
}

export async function createMember(
  provider: string,
  providerId: string,
  email: string | null,
  profileImageUrl?: string | null,
  locale: "ko" | "en" = "en",
): Promise<Member> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const now = new Date();

    // 1. 회원 생성 (닉네임 충돌 시 재시도)
    let result: ResultSetHeader | null = null;
    let finalNickname: string | null = null;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const nickname = generateRandomNickname(locale);
      try {
        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO members (provider, provider_id, email, nickname, profile_image_url, created_at, lasted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            provider,
            providerId,
            email,
            nickname,
            profileImageUrl ?? null,
            now,
            now,
          ],
        );
        result = insertResult;
        finalNickname = nickname;
        break;
      } catch (error: unknown) {
        if (!isDuplicateEntryError(error)) {
          throw error;
        }
      }
    }

    if (!result) {
      // Fallback: deterministic unique-ish nickname, retry a few times
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const fallback = `user${Date.now()}${Math.floor(Math.random() * 10000)}`;
        try {
          const [insertResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO members (provider, provider_id, email, nickname, profile_image_url, created_at, lasted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              provider,
              providerId,
              email,
              fallback,
              profileImageUrl ?? null,
              now,
              now,
            ],
          );
          result = insertResult;
          finalNickname = fallback;
          break;
        } catch (error: unknown) {
          if (!isDuplicateEntryError(error)) {
            throw error;
          }
        }
      }
    }

    if (!result) {
      throw new Error("Failed to generate unique nickname");
    }

    const insertId = result.insertId;

    // 2. 개인 워크스페이스 자동 생성
    await connection.execute(
      `INSERT INTO workspaces (type, owner_id, name, created_by, created_at)
       VALUES ('personal', ?, ?, ?, NOW())`,
      [insertId, `${finalNickname ?? "My"}의 워크스페이스`, insertId],
    );

    await connection.commit();

    return {
      member_id: insertId,
      provider,
      provider_id: providerId,
      email,
      nickname: finalNickname,
      phone_number: null,
      created_at: now,
      lasted_at: now,
      profile_image_url: profileImageUrl ?? null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateMemberLastLogin(memberId: number): Promise<void> {
  await pool.execute("UPDATE members SET lasted_at = ? WHERE member_id = ?", [
    new Date(),
    memberId,
  ]);
}

export async function findMemberByLoginId(
  loginId: string,
): Promise<Member | null> {
  await ensureMemberLocalAuthSchema();
  const normalized = normalizeLoginId(loginId);
  if (!normalized) return null;

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM members WHERE login_id = ? LIMIT 1",
    [normalized],
  );
  return (rows[0] as Member) || null;
}

export async function findLocalMemberByEmail(
  email: string,
): Promise<Member | null> {
  await ensureMemberLocalAuthSchema();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM members WHERE provider = 'local' AND email = ? LIMIT 1",
    [normalized],
  );
  return (rows[0] as Member) || null;
}

export async function findLocalMemberByLoginIdAndEmail(params: {
  loginId: string;
  email: string;
}): Promise<Member | null> {
  await ensureMemberLocalAuthSchema();
  const normalizedLoginId = normalizeLoginId(params.loginId);
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedLoginId || !normalizedEmail) return null;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT *
     FROM members
     WHERE provider = 'local'
       AND login_id = ?
       AND email = ?
     LIMIT 1`,
    [normalizedLoginId, normalizedEmail],
  );
  return (rows[0] as Member) || null;
}

export async function isLoginIdTaken(loginId: string): Promise<boolean> {
  return (await findMemberByLoginId(loginId)) !== null;
}

export async function updateMemberNickname(
  memberId: number,
  nickname: string,
): Promise<void> {
  await pool.execute("UPDATE members SET nickname = ? WHERE member_id = ?", [
    nickname,
    memberId,
  ]);
}

export async function findOrCreateMember(
  provider: string,
  providerId: string,
  email: string | null,
  profileImageUrl?: string | null,
  locale: "ko" | "en" = "en",
): Promise<Member> {
  const existingMember = await findMemberByProvider(provider, providerId);

  if (existingMember) {
    if (!existingMember.profile_image_url && profileImageUrl) {
      await updateMemberProfileImage(existingMember.member_id, profileImageUrl);
    }
    await updateMemberLastLogin(existingMember.member_id);
    return existingMember;
  }

  return createMember(provider, providerId, email, profileImageUrl, locale);
}

export async function createLocalMember(params: {
  loginId: string;
  password: string;
  nickname: string;
  email: string;
}): Promise<Member> {
  await ensureMemberLocalAuthSchema();

  const loginId = normalizeLoginId(params.loginId);
  const nickname = params.nickname.trim();
  const email = params.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(params.password, 10);
  const existing = await findMemberByLoginId(loginId);

  if (existing) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }
  if (isNicknameReserved(nickname)) {
    throw new Error("사용할 수 없는 닉네임입니다.");
  }
  if (await isNicknameTaken(nickname)) {
    throw new Error("이미 사용 중인 닉네임입니다.");
  }
  if (!isValidMemberEmail(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }
  if (await isEmailTaken(email)) {
    throw new Error("이미 사용 중인 이메일입니다.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const now = new Date();
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (
        provider,
        provider_id,
        login_id,
        password_hash,
        email,
        nickname,
        profile_image_url,
        created_at,
        lasted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "local",
        loginId,
        loginId,
        passwordHash,
        email,
        nickname,
        null,
        now,
        now,
      ],
    );

    await connection.execute(
      `INSERT INTO workspaces (type, owner_id, name, created_by, created_at)
       VALUES ('personal', ?, ?, ?, NOW())`,
      [insertResult.insertId, `${nickname}의 워크스페이스`, insertResult.insertId],
    );

    await connection.commit();

    return {
      member_id: insertResult.insertId,
      provider: "local",
      provider_id: loginId,
      login_id: loginId,
      password_hash: passwordHash,
      email,
      nickname,
      phone_number: null,
      created_at: now,
      lasted_at: now,
      profile_image_url: null,
    };
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntryError(error)) {
      throw new Error("이미 사용 중인 아이디 또는 닉네임입니다.");
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyLocalMemberLogin(params: {
  loginId: string;
  password: string;
}): Promise<Member | null> {
  await ensureMemberLocalAuthSchema();
  const member = await findMemberByLoginId(params.loginId);
  if (!member || member.provider !== "local" || !member.password_hash) {
    return null;
  }

  const matches = await bcrypt.compare(params.password, member.password_hash);
  if (!matches) {
    return null;
  }

  await updateMemberLastLogin(member.member_id);
  return member;
}

export async function updateLocalMemberPassword(params: {
  memberId: number;
  password: string;
}) {
  await ensureMemberLocalAuthSchema();
  const passwordHash = await bcrypt.hash(params.password, 10);
  await pool.execute(
    `UPDATE members
     SET password_hash = ?
     WHERE member_id = ?
       AND provider = 'local'`,
    [passwordHash, params.memberId],
  );
}

export async function updateMemberProfileImage(
  memberId: number,
  profileImageUrl: string | null,
): Promise<void> {
  await pool.execute(
    "UPDATE members SET profile_image_url = ? WHERE member_id = ?",
    [profileImageUrl, memberId],
  );
}

export async function isNicknameTaken(
  nickname: string,
  excludeMemberId?: number,
): Promise<boolean> {
  const trimmed = nickname.trim();
  if (!trimmed) return false;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT member_id FROM members WHERE nickname = ? LIMIT 1`,
    [trimmed],
  );
  if (rows.length === 0) return false;
  if (excludeMemberId && rows[0].member_id === excludeMemberId) return false;
  return true;
}

export async function isEmailTaken(
  email: string,
  excludeMemberId?: number,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT member_id FROM members WHERE email = ? LIMIT 1`,
    [normalized],
  );
  if (rows.length === 0) return false;
  if (excludeMemberId && rows[0].member_id === excludeMemberId) return false;
  return true;
}

export function isNicknameReserved(nickname: string): boolean {
  const value = nickname.trim().toLowerCase();
  if (!value) return false;
  const reserved = new Set([
    "admin",
    "administrator",
    "root",
    "system",
    "owner",
    "support",
    "help",
    "moderator",
    "mod",
    "staff",
    "team",
    "official",
    "account",
    "accounts",
    "billing",
    "payment",
    "payments",
    "security",
    "settings",
    "null",
    "undefined",
    "me",
    "you",
    "anonymous",
    "guest",
    "superuser",
    "sysadmin",
    "operator",
    "test",
  ]);
  return reserved.has(value);
}

export async function findMemberByEmailOrNickname(
  identifier: string,
): Promise<Member | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM members WHERE email = ? OR nickname = ? LIMIT 1`,
    [trimmed, trimmed],
  );

  return (rows[0] as Member) || null;
}

export async function findMemberById(memberId: number): Promise<Member | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
    [memberId],
  );
  return (rows[0] as Member) || null;
}

export function isMemberLoginEnabled(
  member: Pick<Member, "provider"> | null,
): boolean {
  if (!member) return false;
  return member.provider !== "deleted";
}
