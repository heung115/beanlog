import { createClient } from "@/lib/supabase/server";
import { getOAuthFailureKind, resolveAuthFailurePath, resolveTrustedAppRedirect } from "@/lib/security/redirect";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRequestAppOrigin } from "@/lib/admin/private-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const configuredAppUrl = await getRequestAppOrigin(request.headers);
  const next = resolveTrustedAppRedirect(
    searchParams.get("next"),
    configuredAppUrl
  );

  if (code && !searchParams.has("error")) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(next);
      }
    } catch {
      // A temporary exchange failure should still offer a usable retry screen.
    }
  }

  const retry = resolveAuthFailurePath(
    searchParams.get("next"),
    getOAuthFailureKind(searchParams.get("error"), searchParams.get("error_code")),
    (await cookies()).get("NEXT_LOCALE")?.value
  );
  const response = NextResponse.redirect(resolveTrustedAppRedirect(retry, configuredAppUrl, "/login"));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
