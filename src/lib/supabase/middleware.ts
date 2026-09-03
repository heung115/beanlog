import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, isUnrecoverableRefreshError } from "./auth-recovery";
import { supabaseCookieOptions } from "./config";
import {
  applySessionPersistence,
  SESSION_ONLY_COOKIE_NAME,
  shouldPersistSession,
} from "./session-persistence";

const AUTH_RESPONSE_HEADERS = ["cache-control", "expires", "pragma"] as const;

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
    return ["login", "signup", "privacy", "terms", "try", "origins"].includes(
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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const persistSession = shouldPersistSession(
    request.cookies.get(SESSION_ONLY_COOKIE_NAME)?.value
  );

  const supabase = createServerClient(
    process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              applySessionPersistence(options, persistSession)
            )
          );
          Object.entries(headers).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (isUnrecoverableRefreshError(authError)) {
    clearAuthCookies(request, supabaseResponse, supabaseCookieOptions.name);
  }

  const { pathname } = request.nextUrl;
  const isAuthPage = /^\/(?:ko|en)\/(?:login|signup(?:\/check-email)?)\/?$/.test(
    pathname
  );

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    const locale = pathname.split("/")[1];
    if (request.nextUrl.searchParams.get("draft") === "1") {
      url.pathname = `/${locale}/beans/new`;
      url.search = "?draft=1";
    } else {
      url.pathname = "/explore";
      url.search = "";
    }
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}
