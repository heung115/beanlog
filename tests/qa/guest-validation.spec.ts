import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} guest whitespace identifies the field and preserves the other input`, async ({ page }) => {
    await page.goto(`/${locale}/try`);
    const values = { name: "Guest coffee", roastery: "Sample roastery", origin_country: "Ethiopia", note: "A fruit-forward sample note." };
    for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
    for (const name of Object.keys(values) as (keyof typeof values)[]) {
      const input = page.locator(`[name="${name}"]`);
      await input.fill("   ");
      await page.getByRole("button", { name: t.guest.temporarySave, exact: true }).click();
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("main").getByRole("alert")).toContainText(t.beans.requiredField.replace("{field}", t.beans[name === "origin_country" ? "originCountry" : name]));
      await expect(page.getByRole("article", { name: t.guest.savedTitle })).toHaveCount(0);
      await input.fill(values[name]);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    }
    await page.getByRole("button", { name: t.guest.temporarySave, exact: true }).click();
    await expect(page.getByRole("article", { name: t.guest.savedTitle })).toContainText(values.note);
    await expect(page).toHaveURL(new RegExp(`/${locale}/try$`));
  });

  test(`${locale} guest without JavaScript explains the limitation and offers a working login link`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/try`);
      await expect(page.getByRole("alert")).toContainText(t.guest.javascriptRequired);
      await expect(page.locator('[name="name"]')).toBeDisabled();
      await expect(page.getByRole("button", { name: t.guest.temporarySave, exact: true })).toBeDisabled();
      await page.getByRole("link", { name: t.guest.loginToKeep, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    } finally { await context.close(); }
  });
}
