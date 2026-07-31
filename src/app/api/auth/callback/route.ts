import { createClient } from "@/lib/supabase/server";
import { resolveTrustedAppRedirect } from "@/lib/security/redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const configuredAppUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  const next = resolveTrustedAppRedirect(
    searchParams.get("next"),
    configuredAppUrl
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(next);
    }
  }

  return NextResponse.redirect(
    resolveTrustedAppRedirect("/login", configuredAppUrl, "/login")
  );
}
