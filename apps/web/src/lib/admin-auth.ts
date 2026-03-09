import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { ADMIN_ROLES, type AdminRole, getAdminSecurityState, normalizeAdminRole } from "@/lib/admin-security";
import { getRequiredEnv } from "@/lib/required-env";

const secret = new TextEncoder().encode(getRequiredEnv("API_SECRET_KEY"));

export interface AdminTokenPayload {
  admin_id: number;
  username: string;
  role: AdminRole;
  type: "admin";
  must_change_password: boolean;
}

export interface AdminAuthError {
  error: string;
  status: number;
}

export function isAdminAuthError(value: AdminTokenPayload | AdminAuthError): value is AdminAuthError {
  return "error" in value;
}

export function isValidAdminRole(role: unknown): role is AdminRole {
  return typeof role === "string" && ADMIN_ROLES.includes(role as AdminRole);
}

export async function verifyAdminToken(request: NextRequest): Promise<AdminTokenPayload | null> {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "admin") return null;

    const adminId = Number(payload.admin_id);
    const username = typeof payload.username === "string" ? payload.username : "";
    if (!Number.isFinite(adminId) || !username) return null;

    return {
      admin_id: adminId,
      username,
      role: normalizeAdminRole(payload.role),
      type: "admin",
      must_change_password: payload.must_change_password === true,
    };
  } catch {
    return null;
  }
}

export async function requireAdminToken(
  request: NextRequest,
  options?: { allowPasswordChangeOnly?: boolean },
): Promise<AdminTokenPayload | AdminAuthError> {
  const admin = await verifyAdminToken(request);
  if (!admin) {
    return { error: "Unauthorized", status: 401 };
  }

  const security = await getAdminSecurityState(admin.admin_id);
  const requiresPasswordChange =
    admin.must_change_password === true || security?.requiresPasswordChange === true;

  if (requiresPasswordChange && !options?.allowPasswordChangeOnly) {
    return { error: "PASSWORD_CHANGE_REQUIRED", status: 428 };
  }

  return {
    admin_id: admin.admin_id,
    username: admin.username,
    role: security?.role ?? admin.role,
    type: "admin",
    must_change_password: requiresPasswordChange,
  };
}

export async function requireAdminRole(
  request: NextRequest,
  roles: AdminRole[],
  options?: { allowPasswordChangeOnly?: boolean },
): Promise<AdminTokenPayload | AdminAuthError> {
  const admin = await requireAdminToken(request, options);
  if (isAdminAuthError(admin)) {
    return admin;
  }

  if (!roles.includes(admin.role)) {
    return { error: "Forbidden", status: 403 };
  }

  return admin;
}
