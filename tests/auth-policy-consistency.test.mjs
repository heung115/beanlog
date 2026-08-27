import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const signupPage = fs.readFileSync(
  new URL("../src/app/[locale]/signup/page.tsx", import.meta.url),
  "utf8"
);
const authActions = fs.readFileSync(
  new URL("../src/lib/actions/auth.ts", import.meta.url),
  "utf8"
);

test("browser and server accept the same six-character signup password", () => {
  const browserMinimum = Number(
    signupPage.match(/name="password"[\s\S]*?minLength=\{(\d+)\}/)?.[1]
  );
  const signUpSchema = authActions.match(
    /const signUpSchema = z\.object\(\{([\s\S]*?)\n\}\);/
  )?.[1] ?? "";
  const serverMinimum = Number(
    signUpSchema.match(/password:\s*z\.string\(\)\.min\((\d+)\)/)?.[1]
  );

  assert.equal(browserMinimum, 6);
  assert.equal(serverMinimum, browserMinimum);
});
