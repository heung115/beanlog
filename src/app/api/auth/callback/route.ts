import { createClient, setSessionPersistencePreference } from "@/lib/supabase/server";
import { getOAuthFailureKind, resolveAuthFailurePath, resolvePasswordRecoveryPath, resolveTrustedAppRedirect } from "@/lib/security/redirect";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRequestAppOrigin } from "@/lib/admin/private-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const recovery = searchParams.get("mode") === "recovery" || searchParams.get("type") === "recovery";
  const preferredLocale = searchParams.get("locale") ?? (await cookies()).get("NEXT_LOCALE")?.value;
  const configuredAppUrl = await getRequestAppOrigin(request.headers);
  const next = resolveTrustedAppRedirect(
    searchParams.get("next"),
    configuredAppUrl
  );

  const tokenHash = searchParams.get("type") === "recovery" ? searchParams.get("token_hash") : null;
  if ((code || tokenHash) && !searchParams.has("error")) {
    try {
      const supabase = await createClient(recovery ? { persistSession: false } : undefined);
      const { error } = tokenHash
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        : await supabase.auth.exchangeCodeForSession(code!);
      if (!error) {
        if (recovery) await setSessionPersistencePreference(false);
        const response = NextResponse.redirect(recovery
          ? resolveTrustedAppRedirect(resolvePasswordRecoveryPath(searchParams.get("next"), preferredLocale), configuredAppUrl)
          : next);
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
    } catch {
      // A temporary exchange failure should still offer a usable retry screen.
    }
  }

  if (recovery) {
    const retry = resolvePasswordRecoveryPath(searchParams.get("next"), preferredLocale, true);
    const response = NextResponse.redirect(resolveTrustedAppRedirect(retry, configuredAppUrl));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
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
