import { expect, test } from "@playwright/test";
import { admin } from "./helpers";

test("email signup opens a dedicated confirmation guide", async ({ page }) => {
  const email = `delivered+beanmap-guidance-${Date.now()}@resend.dev`;

  try {
    await page.goto("/ko/signup?draft=1");
    await page.locator('input[name="displayName"]').fill("인증 안내 테스트");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("signup-guidance-password");
    await page.locator('input[name="passwordConfirm"]').fill("signup-guidance-password");
    await page.getByRole("checkbox", { name: /만 14세 이상이며/ }).check();
    await page.getByRole("button", { name: "회원가입", exact: true }).click();

    await expect(page).toHaveURL(/\/ko\/signup\/check-email\?draft=1$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "인증 메일을 확인해주세요" })
    ).toBeVisible();
    await expect(
      page.getByText("링크를 눌러야 회원가입이 완료됩니다.", { exact: false })
    ).toBeVisible();
    await expect(page.getByText("스팸함과 프로모션함도 확인해주세요.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "인증 완료 후 로그인" })).toHaveAttribute(
      "href",
      "/ko/login?draft=1"
    );
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("nav.fixed")).toHaveCount(0);

    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(error).toBeNull();
    const userId = data.users.find((user) => user.email === email)?.id;
    expect(userId).toBeTruthy();
  } finally {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const userId = data.users.find((user) => user.email === email)?.id;
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});

test("login explains when email confirmation is still required", async ({ page }) => {
  const email = `qa-unconfirmed-${Date.now()}@example.com`;
  const password = "unconfirmed-login-password";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { display_name: "미인증 안내 테스트" },
  });

  expect(error).toBeNull();
  expect(data.user).toBeTruthy();

  try {
    await page.goto("/ko/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "이메일 인증이 아직 완료되지 않았습니다.",
      })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/ko\/login$/);
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
});
