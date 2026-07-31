import { expect, test } from "@playwright/test";
import { getSupabaseCookieName } from "../../src/lib/supabase/cookie-name";
import {
  browserSupabaseUrl,
  qaBaseURL,
  qaUser,
  signIn,
} from "./helpers";

const AUTH_COOKIE_CHUNK_SIZE = 3180;

function encodeAuthCookies(
  session: object,
  storageKey = getSupabaseCookieName(browserSupabaseUrl)
) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks = Array.from(
    { length: Math.ceil(value.length / AUTH_COOKIE_CHUNK_SIZE) },
    (_, index) =>
      value.slice(
        index * AUTH_COOKIE_CHUNK_SIZE,
        (index + 1) * AUTH_COOKIE_CHUNK_SIZE
      )
  );

  return {
    storageKey,
    cookies: chunks.map((chunk, index) => ({
      name: chunks.length === 1 ? storageKey : `${storageKey}.${index}`,
      value: chunk,
      url: qaBaseURL,
      sameSite: "Lax" as const,
    })),
  };
}

function decodeAuthCookie(
  cookies: Array<{ name: string; value: string }>,
  storageKey: string
) {
  const value = cookies
    .filter(
      ({ name }) => name === storageKey || name.startsWith(`${storageKey}.`)
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true })
    )
    .map(({ value: chunk }) => chunk)
    .join("");
  if (!value.startsWith("base64-")) {
    throw new Error("Missing encoded Supabase auth cookie");
  }
  return JSON.parse(
    Buffer.from(value.slice("base64-".length), "base64url").toString("utf8")
  ) as Record<string, unknown> & { refresh_token: string };
}

test("session refresh cookies survive locale proxy composition", async ({
  browser,
}) => {
  const { session } = await signIn(qaUser.email, qaUser.password);
  const expiredSession = {
    ...session,
    expires_at: Math.floor(Date.now() / 1000) - 60,
  };
  const { storageKey, cookies } = encodeAuthCookies(expiredSession);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const response = await context.request.get(`${qaBaseURL}/ko/explore`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  expect(
    response
      .headersArray()
      .some(
        ({ name, value }) =>
          name.toLowerCase() === "set-cookie" && value.includes(storageKey)
      )
  ).toBe(true);
  expect(response.headers()["cache-control"]).toMatch(/(?:no-store|no-cache)/);
  expect(response.headers().pragma).toBe("no-cache");
  expect(response.headers().expires).toBe("0");

  const refreshedSession = decodeAuthCookie(
    await context.cookies(qaBaseURL),
    storageKey
  );
  expect(refreshedSession.refresh_token).not.toBe(session.refresh_token);

  const page = await context.newPage();
  await page.goto(`${qaBaseURL}/ko/explore`);
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await page.reload();
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await page.reload();
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await context.close();
});

test("overlapping session refreshes leave a reusable browser session", async ({
  browser,
}) => {
  const { session } = await signIn(qaUser.email, qaUser.password);
  const expiredSession = {
    ...session,
    expires_at: Math.floor(Date.now() / 1000) - 60,
  };
  const { storageKey, cookies } = encodeAuthCookies(expiredSession);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      context.request.get(`${qaBaseURL}/ko/explore`, { maxRedirects: 0 })
    )
  );
  expect(responses.map((response) => response.status())).toEqual(
    Array.from({ length: 8 }, () => 200)
  );

  const convergedSession = decodeAuthCookie(
    await context.cookies(qaBaseURL),
    storageKey
  );
  expect(convergedSession.refresh_token).not.toBe(session.refresh_token);

  await context.clearCookies();
  await context.addCookies(
    encodeAuthCookies(
      {
        ...convergedSession,
        expires_at: Math.floor(Date.now() / 1000) - 60,
      },
      storageKey
    ).cookies
  );
  const verification = await context.request.get(`${qaBaseURL}/ko/explore`, {
    maxRedirects: 0,
  });
  expect(verification.status()).toBe(200);
  expect(
    verification
      .headersArray()
      .some(
        ({ name, value }) =>
          name.toLowerCase() === "set-cookie" && value.includes(storageKey)
      )
  ).toBe(true);

  const page = await context.newPage();
  await page.goto(`${qaBaseURL}/ko/explore`);
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await page.reload();
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await context.close();
});
