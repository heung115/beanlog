import { expect, test, type Page } from "@playwright/test";
import { qaUser } from "./helpers";

async function openForm(page: Page, locale: "ko" | "en") {
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(qaUser.email);
  await page.locator('[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
  await page.goto(`/${locale}/beans/new`);
}

for (const locale of ["ko", "en"] as const) {
  test(`${locale} authentication links preserve drafts and the requested destination`, async ({ page }) => {
    await page.goto(`/${locale}/login?draft=1`);
    await expect(page.locator('input[name="next"]')).toHaveValue(`/${locale}/beans/new?draft=1`);
    await expect(page.getByRole("banner").locator(`a[href="/${locale}/signup?draft=1"]`)).toBeVisible();

    const destination = `/${locale}/stats?view=origins`;
    await page.goto(`/${locale}/login?next=${encodeURIComponent(destination)}`);
    await expect(page.locator('input[name="next"]')).toHaveValue(destination);
    await page.locator('[name="email"]').fill(qaUser.email);
    await page.locator('[name="password"]').fill(qaUser.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/stats\\?view=origins$`));
  });
}

test("localized landing pages use matching document language and typography", async ({ page }) => {
  await page.goto("/ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  const fonts = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector("h1")!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.title).toBe(fonts.body);
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.locator("h1").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Georgia");
});

for (const locale of ["ko", "en"] as const) {
  test(`${locale} detail regions retain separators while typing`, async ({ page }) => {
    await openForm(page, locale);
    const input = page.getByRole("textbox", { name: locale === "ko" ? "세부 지역" : "Detail region", exact: true });
    await input.pressSequentially("Bensa, Keramo");
    await expect(input).toHaveValue("Bensa, Keramo");
    await input.blur();
    await expect(input).toHaveValue("Bensa, Keramo");
  });

  test(`@mobile ${locale} country suggestions stay inside narrow viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openForm(page, locale);
    await page.locator('input[name="origin_country"]').click();
    const list = page.getByRole("listbox").first();
    await expect(list).toBeVisible();
    const bounds = await list.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await expect(page.getByRole("option").first()).toBeVisible();
  });
}

test("Korean composition Enter commits text without picking a country", async ({ page }) => {
  await openForm(page, "ko");
  const country = page.locator('input[name="origin_country"]');
  await country.fill("코");
  await expect(page.getByRole("listbox")).toBeVisible();
  await country.dispatchEvent("compositionstart");
  await country.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 229 });
  await country.dispatchEvent("compositionend", { data: "코" });
  await country.dispatchEvent("keyup", { key: "Enter", code: "Enter" });
  await expect(country).toHaveValue("코");
  await country.press("Enter");
  await expect(country).not.toHaveValue("코");
});

test("@mobile English guest record wraps long names and notes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/en/try");
  await page.locator('[name="name"]').fill("LongCoffeeName".repeat(10));
  await page.locator('[name="roastery"]').fill("Test Roastery");
  await page.locator('[name="origin_country"]').fill("Ethiopia");
  await page.locator('[name="note"]').fill("CoffeeTastingNote".repeat(50));
  await page.getByRole("button", { name: "Save temporarily" }).click();
  await expect(page.getByRole("heading", { name: "Saved temporarily" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
