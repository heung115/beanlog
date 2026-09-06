import { NextRequest, NextResponse } from "next/server";
import {
  isProtectedPath,
  preserveAuthResponse,
  updateSession,
} from "@/lib/supabase/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getOAuthFailureKind, resolveAuthFailurePath } from "@/lib/security/redirect";
import { isMissingOriginPath } from "@/lib/coffee/origin-route";
import { isAdminPath } from "@/lib/security/admin-boundary";
import { privateAdminContext } from "@/lib/admin/private-access";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Next 16 Proxy runs on Node.js, so the secret can remain a mounted file.
  // Public requests do not learn whether an account has administrator access.
  if (isAdminPath(request.nextUrl.pathname) && !privateAdminContext(request.headers)) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  // API routes (e.g. /api/auth/callback for OAuth code exchange) must pass
  // through untouched — no session redirect, no locale prefixing.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!["GET", "HEAD", "POST"].includes(request.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: "GET, HEAD, POST" },
    });
  }

  // Expired provider state can return to SITE_URL instead of our callback.
  // Give the user a clean retry screen rather than silently showing the home page.
  const home = request.nextUrl.pathname.match(/^\/(?:(ko|en)\/?)?$/);
  if (request.method === "GET" && home && request.nextUrl.searchParams.has("error")) {
    const query = request.nextUrl.searchParams;
    const retry = resolveAuthFailurePath(
      query.get("next"),
      getOAuthFailureKind(query.get("error"), query.get("error_code")),
      home[1] ?? request.cookies.get("NEXT_LOCALE")?.value
    );
    const response = NextResponse.redirect(new URL(retry, request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // The generated Open Graph image has no extension and must bypass locale
  // routing, including locale discovery for unprefixed application paths.
  if (request.nextUrl.pathname === "/opengraph-image") {
    return updateSession(request);
  }

  let preferredLocale: "ko" | "en" | undefined;
  if (isProtectedPath(request.nextUrl.pathname) && !/^\/(ko|en)(?:\/|$)/.test(request.nextUrl.pathname)) {
    // Let next-intl choose the locale from the saved preference/browser before
    // constructing a recovery or login destination for an unprefixed URL.
    const localized = intlMiddleware(request);
    const localizedUrl = localized.headers.get("location") ?? localized.headers.get("x-middleware-rewrite");
    const locale = localized.headers.get("x-middleware-request-x-next-intl-locale")
      ?? (localizedUrl ? new URL(localizedUrl).pathname.split("/")[1] : undefined);
    preferredLocale = locale === "en" ? "en" : "ko";
  }
  const response = await updateSession(request, preferredLocale);

  // Respect auth redirects (e.g. unauthenticated user -> /login).
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    return response;
  }

  const recoveryRewrite = response.headers.get("x-middleware-rewrite");
  if (recoveryRewrite) {
    // Keep next-intl's locale headers and cookies, while serving the recovery
    // page at the original address with its 503 response and retry guidance.
    const localized = intlMiddleware(new NextRequest(recoveryRewrite, { headers: request.headers }));
    const recovery = new NextResponse(null, { status: response.status, headers: localized.headers });
    recovery.headers.delete("location");
    recovery.headers.delete("x-middleware-next");
    recovery.headers.set("x-middleware-rewrite", recoveryRewrite);
    return preserveAuthResponse(response, recovery);
  }

  const localized = preserveAuthResponse(response, intlMiddleware(request));
  // Known dynamic origin routes render recovery content directly so it also
  // works without JavaScript. Preserve the real HTTP error before streaming.
  if (isMissingOriginPath(request.nextUrl.pathname) && !localized.headers.has("location")) {
    return new NextResponse(localized.body, { status: 404, headers: localized.headers });
  }
  return localized;
}

export const config = {
  matcher: ["/:locale(ko|en)/origins/:path*", "/((?!_next|.*\\..*).*)"],
};
