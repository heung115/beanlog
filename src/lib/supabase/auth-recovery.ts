import type { NextRequest, NextResponse } from "next/server";

const UNRECOVERABLE_REFRESH_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
]);

type AuthFailure = {
  code?: unknown;
  message?: unknown;
};

export function isUnrecoverableRefreshError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as AuthFailure;
  if (typeof code === "string" && UNRECOVERABLE_REFRESH_CODES.has(code)) {
    return true;
  }

  // Older GoTrue versions did not always include an error code. Keep this
  // compatibility check deliberately narrow so transient auth failures do not
  // destroy an otherwise recoverable session.
  return (
    typeof message === "string" &&
    /invalid refresh token|refresh token not found|refresh token already used/i.test(
      message
    )
  );
}

function isAuthCookie(name: string, storageKey: string) {
  return name === storageKey || name.startsWith(`${storageKey}.`);
}

export function clearAuthCookies(
  request: NextRequest,
  response: NextResponse,
  storageKey: string
) {
  for (const cookie of request.cookies.getAll()) {
    if (!isAuthCookie(cookie.name, storageKey)) continue;

    request.cookies.delete(cookie.name);
    response.cookies.set(cookie.name, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
