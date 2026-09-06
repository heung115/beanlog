import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, isTemporaryAuthError, isUnrecoverableRefreshError } from "./auth-recovery";
import { supabaseCookieOptions } from "./config";
import {
  applySessionPersistence,
  SESSION_ONLY_COOKIE_NAME,
  shouldPersistSession,
} from "./session-persistence";

const AUTH_RESPONSE_HEADERS = ["cache-control", "expires", "pragma", "retry-after"] as const;

/**
 * Returns whether a pathname can be served without an authenticated session.
 *
 * Keep this segment-based so paths such as `/ko/login-help` cannot inherit the
 * access policy of `/ko/login`. Unknown, well-formed origin slugs are allowed
 * through so the page itself can return a proper localized 404.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;

  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!path.startsWith("/")) return false;

  const [locale, ...route] = path.slice(1).split("/");
  if (locale !== "ko" && locale !== "en") return false;

  if (route.length === 0) return true;

  if (route.length === 1) {
    return ["login", "signup", "privacy", "terms", "try", "origins", "session-unavailable"].includes(
      route[0]
    );
  }

  if (route.length !== 2) return false;
  if (route[0] === "signup") return route[1] === "check-email";

  return (
    route[0] === "origins" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route[1])
  );
}

/**
 * Returns whether a pathname belongs to the signed-in application. Unknown
 * paths deliberately return false so Next.js can serve a real 404 instead of
 * turning missing pages into redirects to the landing page.
 */
export function isProtectedPath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;

  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const segments = path.slice(1).split("/");
  const route =
    segments[0] === "ko" || segments[0] === "en"
      ? segments.slice(1)
      : segments;

  return (
    route.length > 0 &&
    ["explore", "beans", "stats", "settings"].includes(route[0])
  );
}

export function preserveAuthResponse(
  authResponse: NextResponse,
  response: NextResponse
) {
  const authCookies = authResponse.cookies.getAll();
  authCookies.forEach((cookie) => response.cookies.set(cookie));
  AUTH_RESPONSE_HEADERS.forEach((name) => {
    const value = authResponse.headers.get(name);
    if (value) response.headers.set(name, value);
  });
  return response;
}

export async function updateSession(request: NextRequest, preferredLocale?: "ko" | "en") {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const explicitLocale = pathname.match(/^\/(ko|en)(?:\/|$)/)?.[1];
  const locale = explicitLocale ?? preferredLocale ?? "ko";
  const returnPath = `${explicitLocale ? pathname : `/${locale}${pathname}`}${request.nextUrl.search}`;
  // The recovery screen itself needs no identity lookup, so it stays usable
  // while the authentication service is unavailable or rate-limited.
  if (/^\/(?:ko|en)\/session-unavailable\/?$/.test(pathname)) {
    supabaseResponse.headers.set("Cache-Control", "no-store");
    return supabaseResponse;
  }
  const persistSession = shouldPersistSession(
    request.cookies.get(SESSION_ONLY_COOKIE_NAME)?.value
  );
  const cookieBatches: {
    cookies: { name: string; value: string; options: CookieOptions }[];
    headers: Record<string, string>;
  }[] = [];
  const pendingCookies = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));

  const supabase = createServerClient(
    process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return [...pendingCookies].map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet, headers) {
          // The SDK keeps its intermediate session in memory. Delay browser
          // changes until verification tells us whether a removal is final.
          cookiesToSet.forEach(({ name, value }) => pendingCookies.set(name, value));
          cookieBatches.push({ cookies: cookiesToSet, headers });
        },
      },
    }
  );

  let user: User | null = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    if (!isTemporaryAuthError(error)) throw error;
    authError = error;
  }

  const temporaryFailure = isTemporaryAuthError(authError);
  const isSessionCookie = (name: string) => name === supabaseCookieOptions.name
    || name.startsWith(`${supabaseCookieOptions.name}.`);
  const batchesToApply = cookieBatches.map((batch) => {
    // Refresh-token HTTP 429 makes the SDK remove an expired session. Keep
    // that recoverable session, but retain a successful token rotation (and
    // its stale-chunk removals) even if the following user lookup fails.
    const rotatesSession = batch.cookies.some(({ name, value, options }) =>
      isSessionCookie(name) && value !== "" && options.maxAge !== 0
    );
    return {
      ...batch,
      cookies: temporaryFailure && !rotatesSession
        ? batch.cookies.filter(({ name }) => !isSessionCookie(name))
        : batch.cookies,
    };
  });
  for (const batch of batchesToApply) {
    batch.cookies.forEach(({ name, value }) => request.cookies.set(name, value));
  }
  supabaseResponse = NextResponse.next({ request });
  for (const batch of batchesToApply) {
    batch.cookies.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, applySessionPersistence(options, persistSession))
    );
    Object.entries(batch.headers).forEach(([name, value]) => supabaseResponse.headers.set(name, value));
  }

  if (!temporaryFailure && isUnrecoverableRefreshError(authError)) {
    clearAuthCookies(
      request,
      supabaseResponse,
      supabaseCookieOptions.name,
      supabaseCookieOptions.secure
    );
  }

  if (temporaryFailure && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/session-unavailable`;
    url.search = "";
    url.searchParams.set("next", returnPath);
    const response = preserveAuthResponse(supabaseResponse, NextResponse.rewrite(url, { status: 503 }));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Retry-After", "5");
    return response;
  }

  const isAuthPage = /^\/(?:ko|en)\/(?:login|signup(?:\/check-email)?)\/?$/.test(
    pathname
  );

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", returnPath);
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    const locale = pathname.split("/")[1];
    if (request.nextUrl.searchParams.get("draft") === "1") {
      url.pathname = `/${locale}/beans/new`;
      url.search = "?draft=1";
    } else {
      url.pathname = `/${locale}/explore`;
      url.search = "";
    }
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}
