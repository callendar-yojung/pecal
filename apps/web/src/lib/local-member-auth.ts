import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateTokenPair } from "@/lib/jwt";
import { getSessionClientMeta } from "@/lib/session-client-meta";
import {
  createLocalMember,
  findLocalMemberByEmail,
  findLocalMemberByLoginIdAndEmail,
  isEmailTaken,
  isMemberLoginEnabled,
  isLoginIdTaken,
  isNicknameReserved,
  isNicknameTaken,
  isValidLoginId,
  isValidMemberEmail,
  isValidMemberPassword,
  normalizeLoginId,
  updateLocalMemberPassword,
  verifyLocalMemberLogin,
} from "@/lib/member";
import {
  consumePasswordResetVerificationCode,
  consumeVerifiedRegisterEmail,
  sendPasswordResetVerificationCode,
} from "@/lib/local-email-verification";
import { sendLocalLoginIdReminderEmail } from "@/lib/mailer";

const ACCESS_TOKEN_COOKIE_NAME = "PECAL_ACCESS_TOKEN";
const REFRESH_TOKEN_COOKIE_NAME = "PECAL_REFRESH_TOKEN";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export function validateLocalRegisterInput(input: {
  loginId: string;
  password: string;
  nickname: string;
  email: string;
}) {
  const loginId = normalizeLoginId(input.loginId);
  const nickname = input.nickname.trim();
  const email = input.email.trim().toLowerCase();

  if (!isValidLoginId(loginId)) {
    return "아이디는 영문 소문자, 숫자, ., _, - 조합으로 4자 이상이어야 합니다.";
  }
  if (!isValidMemberPassword(input.password)) {
    return "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.";
  }
  if (nickname.length < 2 || nickname.length > 20) {
    return "닉네임은 2자 이상 20자 이하여야 합니다.";
  }
  if (isNicknameReserved(nickname)) {
    return "사용할 수 없는 닉네임입니다.";
  }
  if (!isValidMemberEmail(email)) {
    return "이메일 형식이 올바르지 않습니다.";
  }

  return null;
}

export function validateLocalLoginInput(input: {
  loginId: string;
  password: string;
}) {
  const loginId = normalizeLoginId(input.loginId);
  if (!isValidLoginId(loginId)) {
    return "아이디 형식이 올바르지 않습니다.";
  }
  if (!input.password.trim()) {
    return "비밀번호를 입력해 주세요.";
  }
  return null;
}

export async function checkLocalRegisterAvailability(input: {
  loginId?: string;
  nickname?: string;
}) {
  const result: {
    loginId?: { available: boolean; message: string };
    nickname?: { available: boolean; message: string };
  } = {};

  if (typeof input.loginId === "string") {
    const loginId = normalizeLoginId(input.loginId);
    if (!loginId) {
      result.loginId = { available: false, message: "아이디를 입력해 주세요." };
    } else if (!isValidLoginId(loginId)) {
      result.loginId = {
        available: false,
        message: "아이디는 영문 소문자, 숫자, ., _, - 조합으로 4자 이상이어야 합니다.",
      };
    } else if (await isLoginIdTaken(loginId)) {
      result.loginId = { available: false, message: "이미 사용 중인 아이디입니다." };
    } else {
      result.loginId = { available: true, message: "사용 가능한 아이디입니다." };
    }
  }

  if (typeof input.nickname === "string") {
    const nickname = input.nickname.trim();
    if (!nickname) {
      result.nickname = { available: false, message: "닉네임을 입력해 주세요." };
    } else if (nickname.length < 2 || nickname.length > 20) {
      result.nickname = {
        available: false,
        message: "닉네임은 2자 이상 20자 이하여야 합니다.",
      };
    } else if (isNicknameReserved(nickname)) {
      result.nickname = { available: false, message: "사용할 수 없는 닉네임입니다." };
    } else if (await isNicknameTaken(nickname)) {
      result.nickname = { available: false, message: "이미 사용 중인 닉네임입니다." };
    } else {
      result.nickname = { available: true, message: "사용 가능한 닉네임입니다." };
    }
  }

  return result;
}

export async function registerLocalMember(params: {
  request: NextRequest;
  loginId: string;
  password: string;
  nickname: string;
  email: string;
}) {
  const inputError = validateLocalRegisterInput(params);
  if (inputError) {
    return { error: inputError, status: 400 as const };
  }

  if (await isNicknameTaken(params.nickname.trim())) {
    return { error: "이미 사용 중인 닉네임입니다.", status: 409 as const };
  }
  if (await isEmailTaken(params.email)) {
    return { error: "이미 사용 중인 이메일입니다.", status: 409 as const };
  }
  const verified = await consumeVerifiedRegisterEmail(params.email);
  if (!verified) {
    return {
      error: "이메일 인증을 완료한 뒤 회원가입해 주세요.",
      status: 400 as const,
    };
  }

  const member = await createLocalMember({
    loginId: params.loginId,
    password: params.password,
    nickname: params.nickname.trim(),
    email: params.email.trim().toLowerCase(),
  });

  return issueMemberTokens(params.request, member);
}

export async function loginLocalMember(params: {
  request: NextRequest;
  loginId: string;
  password: string;
}) {
  const inputError = validateLocalLoginInput(params);
  if (inputError) {
    return { error: inputError, status: 400 as const };
  }

  const member = await verifyLocalMemberLogin({
    loginId: params.loginId,
    password: params.password,
  });

  if (!member || !isMemberLoginEnabled(member)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다.", status: 401 as const };
  }

  return issueMemberTokens(params.request, member);
}

export async function sendLocalLoginIdReminder(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();

  if (!isValidMemberEmail(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }

  const member = await findLocalMemberByEmail(email);
  if (!member || !member.login_id) {
    return;
  }

  await sendLocalLoginIdReminderEmail({
    email,
    loginId: member.login_id,
  });
}

export async function requestLocalPasswordReset(params: {
  loginId: string;
  email: string;
}) {
  const loginId = normalizeLoginId(params.loginId);
  const email = params.email.trim().toLowerCase();

  if (!isValidLoginId(loginId)) {
    throw new Error("아이디 형식이 올바르지 않습니다.");
  }
  if (!isValidMemberEmail(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }

  await sendPasswordResetVerificationCode({ loginId, email });
}

export async function resetLocalPassword(params: {
  loginId: string;
  email: string;
  code: string;
  password: string;
}) {
  const loginId = normalizeLoginId(params.loginId);
  const email = params.email.trim().toLowerCase();

  if (!isValidLoginId(loginId)) {
    return { error: "아이디 형식이 올바르지 않습니다.", status: 400 as const };
  }
  if (!isValidMemberEmail(email)) {
    return { error: "이메일 형식이 올바르지 않습니다.", status: 400 as const };
  }
  if (!isValidMemberPassword(params.password)) {
    return {
      error: "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.",
      status: 400 as const,
    };
  }

  const member = await findLocalMemberByLoginIdAndEmail({ loginId, email });
  if (!member || !member.member_id) {
    return {
      error: "입력한 아이디와 이메일에 해당하는 계정을 찾을 수 없습니다.",
      status: 404 as const,
    };
  }

  await consumePasswordResetVerificationCode({
    loginId,
    email,
    code: params.code,
  });
  await updateLocalMemberPassword({
    memberId: member.member_id,
    password: params.password,
  });

  return { success: true as const };
}

async function issueMemberTokens(
  request: NextRequest,
  member: {
    member_id: number;
    nickname: string | null;
    email: string | null;
    provider: string | null;
  },
) {
  const clientMeta = getSessionClientMeta(request);
  const { accessToken, refreshToken, expiresIn } = await generateTokenPair({
    memberId: member.member_id,
    nickname: member.nickname ?? "",
    provider: member.provider ?? "local",
    email: member.email,
    ...clientMeta,
  });

  const body = {
    success: true,
    user: {
      memberId: member.member_id,
      nickname: member.nickname,
      email: member.email,
      provider: member.provider ?? "local",
    },
    accessToken,
    refreshToken,
    expiresIn,
  };

  return { body, accessToken, refreshToken };
}

export function withAuthCookies(
  body: unknown,
  tokens: { accessToken: string; refreshToken: string },
) {
  const response = NextResponse.json(body);
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE_NAME,
    value: tokens.accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE_NAME,
    value: tokens.refreshToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  return response;
}
