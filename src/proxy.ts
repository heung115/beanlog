import { type NextRequest, NextResponse } from "next/server";
import {
  preserveAuthResponse,
  updateSession,
} from "@/lib/supabase/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
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

  const response = await updateSession(request);

  // Respect auth redirects (e.g. unauthenticated user -> /login).
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    return response;
  }

  // Root-level public metadata routes and the landing page are intentionally
  // outside locale routing. In particular, Next's generated Open Graph image
  // has no file extension, so the matcher does not exclude it automatically.
  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/opengraph-image"
  ) {
    return response;
  }

  return preserveAuthResponse(response, intlMiddleware(request));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
