import { expect, test, type Locator, type Page } from "@playwright/test";
import axe from "axe-core";
import { qaEmptyUser, qaUser } from "./helpers";

async function login(page: Page, user = qaUser) {
  await page.goto("/ko/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(?:ko\/)?explore$/);
}

async function expectCompactHeader(
  heading: Locator,
  { maxFontSize = 34, maxHeight = 180 }: { maxFontSize?: number; maxHeight?: number } = {}
) {
  await expect(heading).toBeVisible();
  const metrics = await heading.evaluate((element) => {
    const header = element.closest("header");
    if (!header) throw new Error("Page heading must belong to a header");
    const headingStyle = getComputedStyle(element);
    const headerStyle = getComputedStyle(header);
    return {
      fontSize: Number.parseFloat(headingStyle.fontSize),
      headerHeight: header.getBoundingClientRect().height,
      background: headerStyle.backgroundColor,
      boxShadow: headerStyle.boxShadow,
      borders: [
        headerStyle.borderTopWidth,
        headerStyle.borderRightWidth,
        headerStyle.borderBottomWidth,
        headerStyle.borderLeftWidth,
      ].map(Number.parseFloat),
    };
  });

  expect(metrics.fontSize).toBeLessThanOrEqual(maxFontSize);
  expect(metrics.headerHeight).toBeLessThan(maxHeight);
  expect(metrics.background).toBe("rgba(0, 0, 0, 0)");
  expect(metrics.boxShadow).toBe("none");
  expect(Math.max(...metrics.borders)).toBeLessThanOrEqual(1);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function expectNoSeriousA11yViolations(page: Page) {
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const axeRuntime = (window as typeof window & { axe: typeof axe }).axe;
    const result = await axeRuntime.run(document, { resultTypes: ["violations"] });
    return result.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => violation.id);
  });
  expect(violations).toEqual([]);
}

test("all primary application tabs use the same compact unframed hierarchy", async ({ page }) => {
  await login(page);

  const routes = [
    ["/ko/explore", "커피 기록", "explore-header", true],
    ["/ko/beans/new", "원두 기록", "bean-form-header", false],
    ["/ko/origins", "커피 산지 정보", "origin-index-header", true],
    ["/ko/stats", "커피 통계", "stats-header", true],
    ["/ko/settings", "설정", "settings-header", false],
  ] as const;
  const headingLeftEdges: number[] = [];

  for (const [route, title, headerTestId, hasMeta] of routes) {
    await page.goto(route);
    const heading = page.getByRole("heading", { level: 1, name: title });
    const header = page.getByTestId(headerTestId);
    await expectCompactHeader(heading, { maxHeight: 180 });
    await expect(header.locator(".journal-kicker")).toHaveCount(1);
    await expect(header.locator("h1.app-page-title")).toHaveCount(1);
    await expect(header.locator(".app-page-deck")).toHaveCount(1);
    await expect(header.locator(".folio-label")).toHaveCount(hasMeta ? 1 : 0);
    headingLeftEdges.push(
      await heading.evaluate((element) => element.getBoundingClientRect().left)
    );
    await expectNoHorizontalOverflow(page);
    await expect(
      header.locator('[class*="text-6xl"], [class*="text-7xl"], [class*="text-8xl"]')
    ).toHaveCount(0);

    const activeNavigationLink = page.locator(
      'header nav:visible a[aria-current="page"]'
    );
    await expect(activeNavigationLink).toHaveCount(1);
    const activeAppearance = await activeNavigationLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(activeAppearance.background).toBe("rgba(0, 0, 0, 0)");
    expect(activeAppearance.boxShadow).toBe("none");
  }

  expect(Math.max(...headingLeftEdges) - Math.min(...headingLeftEdges)).toBeLessThanOrEqual(2);

  await page.goto("/ko/stats");
  await expect(page.getByTestId("stats-summary")).toBeVisible();
  const summaryStyles = await page
    .getByTestId("stats-summary")
    .locator(":scope > *")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          shadow: style.boxShadow,
          borders: [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ].map(Number.parseFloat),
        };
      })
    );
  expect(summaryStyles.every((style) => style.shadow === "none")).toBe(true);
  expect(summaryStyles.every((style) => Math.max(...style.borders) === 0)).toBe(true);

  await page.goto("/ko/settings");
  const settingStyles = await page.locator("[data-settings-section]").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        shadow: style.boxShadow,
        borders: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].map(Number.parseFloat),
      };
    })
  );
  expect(settingStyles.length).toBeGreaterThan(0);
  expect(settingStyles.every((style) => style.shadow === "none")).toBe(true);
  expect(settingStyles.every((style) => Math.max(...style.borders) === 0)).toBe(true);
});

test("record detail and edit pages avoid split heroes and repeated elevation", async ({ page }) => {
  await login(page);
  const href = await page.locator('[data-bean-card] h3 a[href*="/beans/"]').first().getAttribute("href");
  if (!href) throw new Error("Missing seeded bean detail link");

  await page.goto(href);
  const detailTitle = page.locator("main h1").first();
  await expectCompactHeader(detailTitle, { maxFontSize: 40, maxHeight: 170 });
  const detailStyles = await page.locator("[data-detail-section]").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).boxShadow)
  );
  expect(detailStyles.length).toBeGreaterThan(0);
  expect(new Set(detailStyles)).toEqual(new Set(["none"]));
  await expectNoHorizontalOverflow(page);
  await detailTitle.evaluate((element) => {
    element.textContent = "A".repeat(200);
  });
  await expectNoHorizontalOverflow(page);

  await page.goto(`${href}/edit`);
  await expectCompactHeader(page.getByRole("heading", { level: 1, name: "기록 수정" }), {
    maxHeight: 180,
  });
  await expectNoHorizontalOverflow(page);
});

test("supporting public pages keep long titles compact without decorative frames", async ({ page }) => {
  const pages = [
    ["/en/origins/papua-new-guinea", "Papua New Guinea", 40, 240],
    ["/ko/try", "로그인 없이 기록하기", 40, 180],
    ["/ko/terms", "서비스 이용약관", 40, 200],
    ["/ko/privacy", "개인정보 처리방침", 40, 200],
  ] as const;

  for (const [route, title, maxFontSize, maxHeight] of pages) {
    await page.goto(route);
    await expectCompactHeader(page.getByRole("heading", { level: 1, name: title }), {
      maxFontSize,
      maxHeight,
    });
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/en/origins/papua-new-guinea");
  for (const testId of ["origin-profile", "origin-growing-info"]) {
    const appearance = await page.getByTestId(testId).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        shadow: style.boxShadow,
        borders: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].map(Number.parseFloat),
      };
    });
    expect(appearance.background).toBe("rgba(0, 0, 0, 0)");
    expect(appearance.shadow).toBe("none");
    expect(Math.max(...appearance.borders)).toBe(0);
  }
  await expectNoSeriousA11yViolations(page);
});

test("@mobile every primary tab remains compact and within the viewport", async ({ page }) => {
  await login(page);

  const routes = [
    ["/ko/explore", "커피 기록"],
    ["/ko/beans/new", "원두 기록"],
    ["/ko/origins", "커피 산지 정보"],
    ["/ko/stats", "커피 통계"],
    ["/ko/settings", "설정"],
  ] as const;

  for (const [route, title] of routes) {
    await page.goto(route);
    const heading = page.getByRole("heading", { level: 1, name: title });
    await expect(heading).toBeVisible();
    expect(
      await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    ).toBeLessThanOrEqual(32);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("nav.fixed.bottom-0")).toBeVisible();
  }
});

test("@mobile empty stats keeps its first action above navigation", async ({ page }) => {
  await login(page, qaEmptyUser);
  await page.goto("/ko/stats");

  await expectCompactHeader(page.getByRole("heading", { level: 1, name: "커피 통계" }), {
    maxHeight: 180,
  });
  const action = page.getByRole("link", { name: "첫 기록 추가" });
  await expect(action).toBeVisible();
  const layout = await page.evaluate(() => {
    const firstAction = document.querySelector<HTMLElement>('main a[href$="/beans/new"]');
    const navigation = document.querySelector<HTMLElement>("nav.fixed.bottom-0");
    if (!firstAction || !navigation) throw new Error("Missing mobile empty stats layout");
    return {
      actionBottom: firstAction.getBoundingClientRect().bottom,
      navigationTop: navigation.getBoundingClientRect().top,
    };
  });
  expect(layout.actionBottom).toBeLessThan(layout.navigationTop);
  await expectNoHorizontalOverflow(page);
});
