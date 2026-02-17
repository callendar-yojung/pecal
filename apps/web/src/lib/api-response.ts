import { NextResponse } from "next/server";

export type ApiErrorResponse = {
  success: false;
  error: string;
  code?: string;
} & Record<string, unknown>;

export type ApiSuccessResponse = {
  success: true;
} & Record<string, unknown>;

export function jsonSuccess(
  data: Record<string, unknown> = {},
  init?: ResponseInit
) {
  return NextResponse.json({ success: true, ...data }, init);
}

export function jsonError(
  message: string,
  status = 400,
  code?: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}), ...extra },
    { status }
  );
}

export function jsonUnauthorized(message = "Unauthorized") {
  return jsonError(message, 401);
}

export function jsonForbidden(message = "Forbidden") {
  return jsonError(message, 403);
}

export function jsonNotFound(message = "Not found") {
  return jsonError(message, 404);
}

export function jsonGone(message = "Gone") {
  return jsonError(message, 410);
}

export function jsonServerError(
  error: unknown,
  message = "Internal server error"
) {
  console.error(message, error);
  return jsonError(message, 500);
}
