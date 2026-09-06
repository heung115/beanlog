import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { qaUser } from "./helpers";

const ko = JSON.parse(fs.readFileSync("src/i18n/ko.json", "utf8"));
const en = JSON.parse(fs.readFileSync("src/i18n/en.json", "utf8"));

async function login(page: Page, locale: "ko" | "en") {
  await page.goto(`/${locale}/login?next=${encodeURIComponent(`/${locale}/explore`)}`);
  await page.locator('input[name="email"]').fill(qaUser.email);
  await page.locator('input[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
  await expect(page.getByTestId("bean-card").first()).toBeVisible();
}

for (const mobile of [false, true]) {
  for (const locale of ["ko", "en"] as const) {
    const copy = locale === "ko" ? ko : en;
    test(`${mobile ? "@mobile " : ""}${locale} search filters and sort survive record back, edit cancel, reload and browser history`, async ({ page }) => {
      await login(page, locale);
      await page.locator('button[aria-controls="explore-filter-panel"]').click();
      const origin = page.getByRole("combobox", { name: copy.explore.allOrigins, exact: true });
      const country = await origin.locator("option").nth(1).getAttribute("value");
      expect(country).toBeTruthy();
      await origin.selectOption(country!);
      await expect(page).toHaveURL(/origin_country=/);
      await expect(page.getByTestId("bean-grid")).toHaveAttribute("aria-busy", "false");
      await expect(page.getByTestId("bean-card").first()).toBeVisible();
      await expect(page.getByTestId("bean-card").first()).toContainText(await origin.locator("option:checked").innerText());
      const name = await page.getByTestId("bean-card").first().locator("h3").innerText();
      await page.getByRole("searchbox").fill(name);
      await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(name);
      await page.getByRole("combobox", { name: copy.explore.sortBy, exact: true }).selectOption("name");
      await expect(page).toHaveURL(/sort=name/);
      await expect(page.getByTestId("bean-card")).toHaveCount(1);
      const card = page.getByTestId("bean-card");
      const cardId = await card.getAttribute("id");
      const expectedReturn = `${new URL(page.url()).pathname}${new URL(page.url()).search}#${cardId}`;
      // The visible card arrow is part of the same semantic link as its title.
      await card.scrollIntoViewIfNeeded();
      const cardBox = await card.boundingBox();
      const arrowBox = await card.locator('span[aria-hidden="true"]').last().boundingBox();
      expect(cardBox && arrowBox).toBeTruthy();
      await card.click({ position: { x: arrowBox!.x + arrowBox!.width / 2 - cardBox!.x, y: arrowBox!.y + arrowBox!.height / 2 - cardBox!.y } });
      await expect(page.getByTestId("bean-detail-header")).toBeVisible();
      await page.getByRole("button", { name: copy.beans.edit, exact: true }).click();
      await expect(page).toHaveURL(/\/edit\?returnTo=/);
      await page.getByRole("button", { name: copy.common.cancel, exact: true }).click();
      await expect(page.getByTestId("bean-detail-header")).toBeVisible();
      await page.getByRole("link", { name: copy.beans.back, exact: true }).click();
      await expect.poll(() => `${new URL(page.url()).pathname}${new URL(page.url()).search}${new URL(page.url()).hash}`).toBe(expectedReturn);
      await expect(page.getByRole("searchbox")).toHaveValue(name);
      await expect(page.getByRole("combobox", { name: copy.explore.sortBy, exact: true })).toHaveValue("name");
      await page.reload();
      await expect(page.getByRole("searchbox")).toHaveValue(name);
      await expect(page.getByTestId("bean-card")).toHaveCount(1);
      await page.locator('button[aria-controls="explore-filter-panel"]').click();
      await expect(origin).toHaveValue(country!);
      await page.getByRole("combobox", { name: copy.explore.sortBy, exact: true }).selectOption("score");
      await expect(page).toHaveURL(/sort=score/);
      await page.goBack();
      await expect(page.getByRole("combobox", { name: copy.explore.sortBy, exact: true })).toHaveValue("name");
      await expect(page.getByRole("searchbox")).toHaveValue(name);
    });

    test(`${mobile ? "@mobile " : ""}${locale} loaded pages and the source card survive reload and return`, async ({ page }) => {
      await login(page, locale);
      await expect(page.getByTestId("bean-card")).toHaveCount(20);
      await page.getByRole("button", { name: copy.explore.loadMore, exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect.poll(() => page.getByTestId("bean-card").count()).toBeGreaterThan(20);
      const count = await page.getByTestId("bean-card").count();
      const cardId = await page.getByTestId("bean-card").last().getAttribute("id");
      await page.reload();
      await expect(page.getByTestId("bean-card")).toHaveCount(count);
      await page.getByTestId("bean-card").last().locator("h3 a").click();
      await expect(page.getByTestId("bean-detail-header")).toBeVisible();
      await page.getByRole("link", { name: copy.beans.back, exact: true }).click();
      await expect(page.getByTestId("bean-card")).toHaveCount(count);
      const restoredCard = page.locator(`#${cardId}`);
      await expect(restoredCard).toBeFocused();
      await expect(restoredCard).toBeInViewport();
    });

    test(`${mobile ? "@mobile " : ""}${locale} record deletion keeps focus and gives a persistent retryable failure`, async ({ page }) => {
      await login(page, locale);
      await page.getByTestId("bean-card").first().locator("h3 a").click();
      await expect(page.getByTestId("bean-detail-header")).toBeVisible();
      const deleteButton = page.getByRole("button", { name: copy.beans.delete, exact: true });
      await deleteButton.click();
      const confirmation = page.getByRole("group", { name: copy.beans.deleteConfirm });
      await expect(confirmation.getByRole("button", { name: copy.common.cancel, exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(confirmation).toHaveCount(0);
      await expect(deleteButton).toBeFocused();
      await deleteButton.click();
      let deleteRequests = 0;
      await page.route("**/*", async (route) => {
        if (route.request().method() === "POST") {
          deleteRequests += 1;
          await route.abort("failed");
        } else await route.continue();
      });
      await confirmation.getByRole("button", { name: copy.beans.delete, exact: true }).evaluate((element: HTMLButtonElement) => {
        element.click();
        element.click();
      });
      await expect(confirmation.getByRole("alert")).toHaveText(copy.beans.deleteFailed);
      expect(deleteRequests).toBe(1);
      await expect(confirmation.getByRole("button", { name: copy.common.cancel, exact: true })).toBeFocused();
      await page.unroute("**/*");
      await page.keyboard.press("Escape");
      await expect(deleteButton).toBeFocused();
      await expect(page.getByTestId("bean-detail-header")).toBeVisible();
    });
  }
}
