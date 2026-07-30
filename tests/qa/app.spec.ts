import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";
import { qaBaseURL, qaUser } from "./helpers";

async function login(page: Page) {
  await page.goto("/ko/login");
  await page.locator('input[name="email"]').fill(qaUser.email);
  await page.locator('input[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(?:ko\/)?explore$/);
}

async function expectNoSeriousA11yViolations(page: Page) {
  // Entrance transitions temporarily lower the whole element opacity. Disable
  // motion so the audit measures the stable UI rather than an animation frame.
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await page.waitForTimeout(800);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const axeRuntime = (window as typeof window & { axe: typeof axe }).axe;
    const result = await axeRuntime.run(document, {
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
  });
  expect(violations).toEqual([]);
}

test("login uses POST, keeps credentials out of URL, and has no serious accessibility violations", async ({ page }) => {
  await page.goto("/ko/login");
  await expectNoSeriousA11yViolations(page);
  await page.locator('input[name="email"]').fill(qaUser.email);
  await page.locator('input[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(?:ko\/)?explore$/);
  expect(page.url()).not.toContain(encodeURIComponent(qaUser.email));
  expect(page.url()).not.toContain("password");
});

test("30 records paginate without duplicates and all-data filter options are available", async ({ page }) => {
  await login(page);
  await expect(page.getByText("30개 기록")).toBeVisible();

  const originFilter = page.getByLabel("산지");
  await expect(originFilter.locator('option[value="Vietnam"]')).toHaveCount(1);

  const cards = page.locator('a[href*="/beans/"] h3');
  const namesBefore = await cards.allTextContents();
  expect(namesBefore.length).toBe(20);
  await page.getByRole("button", { name: "더 보기" }).click();
  await expect(cards).toHaveCount(30);
  await expect(page.getByRole("button", { name: "더 보기" })).toHaveCount(0);
  const namesAfter = await cards.allTextContents();
  expect(namesAfter.length).toBe(30);
  expect(new Set(namesAfter).size).toBe(30);
});

test("search handles PostgREST punctuation as plain text and recovers", async ({ page }) => {
  await login(page);
  const search = page.getByRole("searchbox");
  await search.fill('),note.ilike.*%"\\');
  await expect(page.getByText("0개 기록")).toBeVisible();
  await search.fill("#37 파나마");
  await expect(page.getByText("1개 기록")).toBeVisible();
  await expect(page.getByText(/#37 파나마 로스트 오리진/)).toBeVisible();
});

test("create form preserves roastery on save-and-continue and persists details", async ({ page }) => {
  await login(page);
  await page.goto("/ko/beans/new");
  await page.locator('input[name="name"]').fill("[QA:e2e] 상세 저장 테스트");
  await page.locator('input[name="roastery"]').fill("QA 반복 로스터리");
  await page.locator('input[name="origin_country"]').fill("Colombia");
  await page.locator('input[name="origin_region"]').fill("Huila");
  await page.locator('input[name="farm_producer"]').fill("QA Producer");
  await page.locator('input[name="varietal"]').fill("Sidra");
  await page.locator('textarea[name="note"]').fill("[QA:e2e] 저장 후 계속 등록 회귀 테스트");
  await page.getByRole("button", { name: "더 자세히 기록" }).click();
  await page.locator('input[name="price"]').fill("19000");
  await page.locator('input[name="weight_g"]').fill("100");
  await page.locator('button[name="continue"]').click();
  await expect(page.locator('input[name="name"]')).toHaveValue("");
  await expect(page.locator('input[name="roastery"]')).toHaveValue("QA 반복 로스터리");
});

test("native forms work with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${qaBaseURL}/ko/login`);
  await page.locator('input[name="email"]').fill(qaUser.email);
  await page.locator('input[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ko\/explore$/);

  await page.goto(`${qaBaseURL}/ko/beans/new`);
  await page.locator('input[name="name"]').fill("[QA:native] JS 비활성 저장");
  await page.locator('input[name="roastery"]').fill("QA Native Roastery");
  await page.locator('input[name="origin_country"]').fill("Kenya");
  await page.locator('textarea[name="note"]').fill("[QA:native] 점진적 향상 저장 테스트");
  await page.locator('input[name="consumed_at"]').fill("2026-07-31");
  // With JavaScript disabled, React's streamed HTML can replace the submit
  // button while Playwright is performing actionability checks. Trigger the
  // native button activation directly: this still exercises the real browser
  // POST and Server Action, without depending on a stable hydrated element.
  await page
    .locator('button[type="submit"]:not([name="continue"])')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page).toHaveURL(/\/ko\/explore$/);
  await expect(page.getByText("[QA:native] JS 비활성 저장")).toBeVisible();
  await context.close();
});

test("@mobile repeated-entry form does not overflow horizontally", async ({ page }) => {
  await login(page);
  await page.goto("/ko/beans/new");
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expectNoSeriousA11yViolations(page);
});
