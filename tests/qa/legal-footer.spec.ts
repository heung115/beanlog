import { expect, test } from "@playwright/test";

test("the landing footer links to the Korean legal pages", async ({ page }) => {
  await page.goto("/");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "이용약관" })).toHaveAttribute(
    "href",
    "/ko/terms"
  );
  await expect(
    footer.getByRole("link", { name: "개인정보 처리방침" })
  ).toHaveAttribute("href", "/ko/privacy");
});

test("localized pages expose matching legal links", async ({ page }) => {
  await page.goto("/en/login");

  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", { name: "Terms of Service" })
  ).toHaveAttribute("href", "/en/terms");
  await expect(
    footer.getByRole("link", { name: "Privacy Policy" })
  ).toHaveAttribute("href", "/en/privacy");
});
