import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";
import { qaBaseURL, qaUser } from "./helpers";
import designTokens from "../../src/config/design-tokens.json";

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
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          summary: node.failureSummary,
        })),
      }));
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
  await page.getByLabel("로스터리").selectOption({ label: "QA Boundary Roastery" });
  await expect(page.getByText("10개 기록")).toBeVisible();

  const originFilter = page.getByLabel("산지");
  await expect(originFilter.locator('option[value="Vietnam"]')).toHaveCount(1);

  const cards = page.locator('a[href*="/beans/"] h3');
  await expect(cards).toHaveCount(10);
  await expect(page.getByRole("button", { name: "더 보기" })).toHaveCount(0);
  const names = await cards.allTextContents();
  expect(new Set(names).size).toBe(10);
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

test("collapsed detail fields stay out of the DOM and expand on demand", async ({ page }) => {
  await login(page);
  await page.goto("/ko/beans/new");

  await expect(page.locator('input[name="process_detail"]')).toHaveCount(0);
  const detailToggle = page.locator('button[aria-controls="bean-detail-fields"]');
  await expect(detailToggle).toHaveAttribute("aria-expanded", "false");
  await detailToggle.click();
  await expect(detailToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#bean-detail-fields")).toBeVisible();
  await expect(page.locator('input[name="process_detail"]')).toBeVisible();
});

test("coffee category badges meet WCAG AA text contrast", async ({ page }) => {
  await login(page);
  const colors = await page
    .locator('a[href*="/beans/"] span[class*="bg-process-"], a[href*="/beans/"] span[class*="bg-roast-"]')
    .evaluateAll((badges) => badges.map((badge) => getComputedStyle(badge).color));

  expect(colors.length).toBeGreaterThan(0);
  const expectedColor = await page.evaluate(
    (token) => {
      const probe = document.createElement("span");
      probe.style.color = token;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();
      return computed;
    },
    designTokens.colors.brown
  );
  expect(new Set(colors)).toEqual(new Set([expectedColor]));
  await expectNoSeriousA11yViolations(page);
});

test("bean detail uses one canvas and keeps the overall score free of a top rule", async ({ page }) => {
  await login(page);
  const firstBeanCard = page
    .locator('a[href*="/beans/"]')
    .filter({ has: page.locator("h3") })
    .first();
  await firstBeanCard.click();
  await expect(page).toHaveURL(/\/beans\/(?!new(?:[/?#]|$))[^/?#]+/);
  await expect(page.getByTestId("bean-overall-score")).toBeVisible();

  const appearance = await page.evaluate(() => {
    const score = document.querySelector<HTMLElement>('[data-testid="bean-overall-score"]');
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-detail-section]")
    );
    if (!score) throw new Error("Missing overall score section");

    const scoreStyle = getComputedStyle(score);
    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      sectionBackgrounds: sections.map(
        (section) => getComputedStyle(section).backgroundColor
      ),
      sectionRadii: sections.map(
        (section) => getComputedStyle(section).borderRadius
      ),
      scoreBorderTopWidth: scoreStyle.borderTopWidth,
    };
  });

  const expectedCanvas = await page.evaluate(
    (token) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = token;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return computed;
    },
    designTokens.colors.cream
  );

  expect(appearance.bodyBackground).toBe(expectedCanvas);
  expect(new Set(appearance.sectionBackgrounds)).toEqual(
    new Set(["rgba(0, 0, 0, 0)"])
  );
  expect(new Set(appearance.sectionRadii)).toEqual(new Set(["0px"]));
  expect(appearance.scoreBorderTopWidth).toBe("0px");
  await expectNoSeriousA11yViolations(page);
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
  await expect(
    page.getByRole("link", { name: /\[QA:native\] JS 비활성 저장 QA Native Roastery/ }).first()
  ).toBeVisible();
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

test("@mobile filters and navigation provide comfortable touch targets", async ({ page }) => {
  await login(page);
  const heights = await page.locator("main select, body > nav a").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height)
  );
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
});
