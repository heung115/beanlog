import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const { getSupabaseCookieName } = await import(
  "../src/lib/supabase/cookie-name.ts"
);

test("the staging environment uses the conventional Supabase auth cookie", () => {
  assert.equal(
    getSupabaseCookieName("http://localhost:55321"),
    "sb-localhost-auth-token"
  );
});

test("hosted Supabase projects keep the conventional project-ref cookie", () => {
  assert.equal(
    getSupabaseCookieName("https://abcdefghijklmnopqrst.supabase.co"),
    "sb-abcdefghijklmnopqrst-auth-token"
  );
});

test("Supabase auth cookies are hardened on the server", () => {
  const config = fs.readFileSync(
    new URL("../src/lib/supabase/config.ts", import.meta.url),
    "utf8"
  );

  assert.match(config, /httpOnly:\s*true/);
  assert.match(config, /sameSite:\s*["']lax["']/);
  assert.match(
    config,
    /secure:\s*process\.env\.NODE_ENV\s*===\s*["']production["']/
  );
});

test("OAuth uses the public Supabase host with the shared PKCE cookie adapter", () => {
  const serverClient = fs.readFileSync(
    new URL("../src/lib/supabase/server.ts", import.meta.url),
    "utf8"
  );
  const authActions = fs.readFileSync(
    new URL("../src/lib/actions/auth.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverClient, /createPublicClient/);
  assert.match(serverClient, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(serverClient, /cookieOptions: supabaseCookieOptions/);
  assert.match(
    authActions,
    /await createPublicClient\(\{ persistSession: true \}\)/
  );
  assert.doesNotMatch(authActions, /setAll:\s*\(\)\s*=>\s*\{\}/);
});
