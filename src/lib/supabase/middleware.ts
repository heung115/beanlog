import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, isUnrecoverableRefreshError } from "./auth-recovery";
import { supabaseCookieOptions } from "./config";

const AUTH_RESPONSE_HEADERS = ["cache-control", "expires", "pragma"] as const;

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
            supabaseResponse.cookies.set(name, value, options)
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
  const isAuthPage = pathname.includes("/login") || pathname.includes("/signup");
  const isPublicPath = pathname === "/" || isAuthPage;

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/explore";
    return preserveAuthResponse(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}
