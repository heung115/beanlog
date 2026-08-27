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

  // The public landing page is intentionally outside locale routing.
  if (request.nextUrl.pathname === "/") {
    return response;
  }

  return preserveAuthResponse(response, intlMiddleware(request));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
