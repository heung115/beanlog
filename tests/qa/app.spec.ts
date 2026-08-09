import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";
import { qaBaseURL, qaUser } from "./helpers";
import designTokens from "../../src/config/design-tokens.json" with { type: "json" };

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
  await page.getByRole("button", { name: "필터" }).click();
  await page.locator('select[aria-label="로스터리"]').selectOption({ label: "QA Boundary Roastery" });
  await expect(page.getByText("10개 기록")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "로스터리 QA Boundary Roastery 필터 제거" })
  ).toBeVisible();

  const originFilter = page.locator('select[aria-label="산지"]');
  await expect(originFilter.locator('option[value="Vietnam"]')).toHaveCount(1);

  const cards = page.locator("[data-bean-card] h3");
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
  await expect(
    page.getByRole("heading", { name: /#37 파나마 로스트 오리진/ })
  ).toBeVisible();
});

test("origin hub opens flavor and regional guidance without card shortcuts", async ({ page }) => {
  await login(page);
  await page.getByRole("searchbox").fill("#12 에티오피아");
  await expect(page.getByText("1개 기록")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "에티오피아 산지 가이드 보기" })
  ).toHaveCount(0);

  const originTab = page.getByRole("link", { name: "산지 정보", exact: true }).first();
  await originTab.click();
  await expect(page).toHaveURL(/\/ko\/origins$/);
  await expect(page.getByRole("heading", { level: 1, name: "커피 산지 정보" })).toBeVisible();
  await expect(page.getByText("20개 산지")).toBeVisible();

  const originGuideLink = page.getByRole("link", {
    name: "에티오피아 자세히 보기",
  });
  await expect(originGuideLink).toBeVisible();
  await originGuideLink.click();
  await expect(page).toHaveURL(/\/ko\/origins\/ethiopia$/);
  await expect(page.getByRole("heading", { level: 1, name: "에티오피아" })).toBeVisible();
  await expect(page.getByText("화사한 꽃향", { exact: true })).toBeVisible();
  await expect(page.getByText("예가체프", { exact: true })).toBeVisible();

  await page.goto("/ko/explore");
  await page.getByRole("searchbox").fill("#12 에티오피아");
  await expect(page.getByText("1개 기록")).toBeVisible();
  const beanCard = page.locator("[data-bean-card]").filter({
    hasText: "#12 에티오피아",
  });
  await beanCard.locator('a[href*="/beans/"]').click();
  await expect(page.getByTestId("origin-flavor-guide")).toContainText(
    "화사한 꽃향, 시트러스, 베리, 차 같은 바디"
  );
  const detailOriginGuideLink = page.getByTestId("origin-detail-guide-link");
  await expect(detailOriginGuideLink).toHaveText("에티오피아 산지 가이드 보기");
  const detailOriginGuideLinkBox = await detailOriginGuideLink.boundingBox();
  expect(detailOriginGuideLinkBox?.height).toBeGreaterThanOrEqual(40);
  await detailOriginGuideLink.click();
  await expect(page).toHaveURL(/\/ko\/origins\/ethiopia$/);
});

test("varietal filter separates multi-varietal records into single options", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "필터" }).click();
  const varietalFilter = page.locator('select[aria-label="품종"]');

  await expect(varietalFilter.locator('option[value="Catuai"]')).toHaveCount(1);
  await expect(varietalFilter.locator('option[value="Typica"]')).toHaveCount(1);
  await expect(varietalFilter.locator('option[value="Catimor"]')).toHaveCount(1);
  await expect(
    varietalFilter.locator('option[value="Catuai, Typica, Catimor"]')
  ).toHaveCount(0);

  await varietalFilter.selectOption("Catuai");
  await expect(page.getByText("1개 기록")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: /#15 태국 치앙 마이/ })
  ).toBeVisible();
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

test("coffee card metadata uses the readable secondary text token", async ({ page }) => {
  await login(page);
  const metadata = page.getByTestId("bean-card-metadata");
  await expect(metadata.first()).toBeVisible();
  const colors = await metadata.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).color)
  );

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
    designTokens.colors["brown-medium"]
  );
  expect(new Set(colors)).toEqual(new Set([expectedColor]));
  await expectNoSeriousA11yViolations(page);
});

test("explore uses restrained corners for cards and filters", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "필터" }).click();

  const firstCard = page.locator("[data-bean-card]").first();
  const radii = await Promise.all([
    page.getByRole("searchbox").evaluate((element) => getComputedStyle(element).borderRadius),
    page.locator('select[aria-label="산지"]').evaluate((element) => getComputedStyle(element).borderRadius),
    firstCard.evaluate((element) => getComputedStyle(element).borderRadius),
  ]);
  expect(new Set(radii)).toEqual(new Set(["2px"]));
});

test("explore switches between grid and list views and restores the choice", async ({ page }) => {
  await login(page);

  const grid = page.getByTestId("bean-grid");
  const cards = page.getByTestId("bean-card");
  await expect(cards.first()).toBeVisible();
  await page.getByRole("button", { name: "그리드 보기" }).click();

  const gridLayout = await grid.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(gridLayout.columns).toBe(2);
  expect(gridLayout.scrollWidth).toBeLessThanOrEqual(gridLayout.width + 1);

  const firstRow = await cards.evaluateAll((elements) =>
    elements.slice(0, 2).map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    })
  );
  expect(firstRow).toHaveLength(2);
  expect(Math.abs(firstRow[0].top - firstRow[1].top)).toBeLessThanOrEqual(1);
  expect(Math.abs(firstRow[0].height - firstRow[1].height)).toBeLessThanOrEqual(1);

  const listButton = page.getByRole("button", { name: "목록 보기" });
  await listButton.click();
  await expect(listButton).toHaveAttribute("aria-pressed", "true");
  await expect(grid).toHaveAttribute("data-view", "list");
  expect(
    await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
    )
  ).toBe(1);

  await page.reload();
  await expect(page.getByTestId("bean-grid")).toHaveAttribute("data-view", "list");
  await expect(page.getByRole("button", { name: "목록 보기" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("@mobile explore keeps the record grid to one column", async ({ page }) => {
  await login(page);

  const grid = page.getByTestId("bean-grid");
  await expect(page.getByTestId("bean-card").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "목록 보기" })).toBeHidden();
  await expect(page.getByRole("button", { name: "그리드 보기" })).toBeHidden();
  const layout = await grid.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      width: rect.width,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(layout.columns).toBe(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test("explore progressively discloses aligned filters without overflow", async ({ page }) => {
  await login(page);

  const filterToggle = page.getByRole("button", { name: "필터" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#explore-filter-panel")).toHaveCount(0);
  await expect(page.locator("main select")).toHaveCount(1);

  await filterToggle.click();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#explore-filter-panel")).toBeVisible();

  const layout = await page.evaluate(() => {
    const search = document.querySelector<HTMLElement>('main input[type="search"]');
    const filterButton = document.querySelector<HTMLElement>(
      'main button[aria-controls="explore-filter-panel"]'
    );
    const sort = document.querySelector<HTMLElement>('main select[aria-label="정렬"]');
    const panel = document.querySelector<HTMLElement>("#explore-filter-panel");
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>("#explore-filter-panel select")
    );
    if (!search || !filterButton || !sort || !panel) {
      throw new Error("Missing explore filter controls");
    }

    const searchRect = search.getBoundingClientRect();
    const filterButtonRect = filterButton.getBoundingClientRect();
    const sortRect = sort.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const rects = controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        label: control.getAttribute("aria-label"),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    });

    return {
      toolbar: [searchRect, filterButtonRect, sortRect].map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      })),
      panel: { left: panelRect.left, right: panelRect.right },
      rects,
      documentOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout.rects).toHaveLength(6);
  expect(layout.documentOverflow).toBe(0);
  expect(new Set(layout.toolbar.map((rect) => Math.round(rect.top))).size).toBe(1);
  expect(new Set(layout.toolbar.map((rect) => Math.round(rect.bottom))).size).toBe(1);
  expect(layout.toolbar[1].left).toBeGreaterThan(layout.toolbar[0].right);
  expect(layout.toolbar[2].left).toBeGreaterThan(layout.toolbar[1].right);
  expect(new Set(layout.rects.map((rect) => Math.round(rect.top))).size).toBe(2);
  expect(
    Math.max(...layout.rects.map((rect) => rect.width)) -
      Math.min(...layout.rects.map((rect) => rect.width))
  ).toBeLessThanOrEqual(1);
  expect(layout.rects[0].left).toBeCloseTo(layout.panel.left, 0);
  expect(layout.rects[2].right).toBeCloseTo(layout.panel.right, 0);

  for (const rowStart of [0, 3]) {
    for (let index = rowStart + 1; index < rowStart + 3; index += 1) {
      expect(layout.rects[index].left).toBeGreaterThan(layout.rects[index - 1].right);
    }
  }
});

test("bean detail uses white cards without a dark overall-score top rule", async ({ page }) => {
  await login(page);
  const firstBeanCard = page.locator('[data-bean-card] h3 a[href*="/beans/"]').first();
  await firstBeanCard.click();
  await expect(page).toHaveURL(/\/beans\/(?!new(?:[/?#]|$))[^/?#]+/);
  await expect(page.getByTestId("bean-overall-score")).toBeVisible();

  const appearance = await page.evaluate(() => {
    const score = document.querySelector<HTMLElement>('[data-testid="bean-overall-score"]');
    const title = document.querySelector<HTMLElement>("main h1");
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-detail-section]")
    );
    if (!score) throw new Error("Missing overall score section");
    if (!title) throw new Error("Missing bean title");

    const scoreStyle = getComputedStyle(score);
    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      titleFontFamily: getComputedStyle(title).fontFamily,
      sectionBackgrounds: sections.map(
        (section) => getComputedStyle(section).backgroundColor
      ),
      sectionRadii: sections.map(
        (section) => getComputedStyle(section).borderRadius
      ),
      scoreBorderTopWidth: scoreStyle.borderTopWidth,
      scoreBorderTopColor: scoreStyle.borderTopColor,
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
  const expectedSurface = await page.evaluate(
    (token) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = token;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return computed;
    },
    designTokens.colors.surface
  );
  const expectedBorder = await page.evaluate(
    (token) => {
      const probe = document.createElement("span");
      probe.style.borderTop = `1px solid ${token}`;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).borderTopColor;
      probe.remove();
      return computed;
    },
    designTokens.colors.border
  );

  expect(appearance.bodyBackground).toBe(expectedCanvas);
  expect(appearance.titleFontFamily).toBe(appearance.bodyFontFamily);
  expect(new Set(appearance.sectionBackgrounds)).toEqual(
    new Set([expectedSurface])
  );
  expect(new Set(appearance.sectionRadii)).toEqual(new Set(["2px"]));
  expect(appearance.scoreBorderTopWidth).toBe("1px");
  expect(appearance.scoreBorderTopColor).toBe(expectedBorder);
  await expectNoSeriousA11yViolations(page);
});

test("bean detail keeps review and cup notes before origin guidance", async ({ page }) => {
  await login(page);
  await page.getByRole("searchbox").fill("#11 브라질");
  const beanCard = page.locator("[data-bean-card]").filter({ hasText: "#11 브라질" });
  await expect(beanCard).toBeVisible();
  await beanCard.locator('h3 a[href*="/beans/"]').click();

  const score = page.getByTestId("bean-overall-score");
  const cupNotes = page.getByTestId("bean-cup-notes");
  const origin = page.getByTestId("bean-origin-info");
  const processRoast = page.getByTestId("bean-process-roast-info");
  await expect(score).toBeVisible();
  await expect(score.getByText(/언스페셜티 7월 월픽/)).toBeVisible();
  await expect(cupNotes).toContainText("초콜릿");
  await expect(cupNotes).toContainText("캐러멜");
  await expect(origin).toBeVisible();
  await expect(processRoast).toBeVisible();

  const followsExpectedOrder = await page.evaluate(() => {
    const ids = [
      "bean-overall-score",
      "bean-cup-notes",
      "bean-origin-info",
      "bean-process-roast-info",
    ];
    const elements = ids.map((id) => document.querySelector(`[data-testid="${id}"]`));
    return elements.every(Boolean) && elements.slice(0, -1).every((element, index) =>
      Boolean(
        element &&
          elements[index + 1] &&
          element.compareDocumentPosition(elements[index + 1]!) &
            Node.DOCUMENT_POSITION_FOLLOWING
      )
    );
  });
  expect(followsExpectedOrder).toBe(true);

  const reviewStyle = await score.locator("p").last().evaluate((element) => ({
    fontStyle: getComputedStyle(element).fontStyle,
    text: element.textContent,
  }));
  expect(reviewStyle.fontStyle).toBe("normal");
  expect(reviewStyle.text).not.toMatch(/^[“\"]/);
  expect(reviewStyle.text).not.toMatch(/[”\"]$/);

  const editButton = page.getByRole("button", { name: "수정", exact: true });
  expect(
    await editButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
    })
  ).toEqual(["0px", "0px", "0px", "0px"]);
  await expect(page.getByText("싱글오리진", { exact: true })).toHaveCount(0);

  const guideLink = page.getByTestId("origin-detail-guide-link");
  await expect(guideLink).toHaveText("브라질 산지 가이드 보기");
  await guideLink.click();
  await expect(page).toHaveURL(/\/ko\/origins\/brazil$/);
  await expect(page.getByText("견과", { exact: true })).toBeVisible();
  await expect(page.getByText("세하도", { exact: true })).toBeVisible();
});

test("@mobile bean detail keeps cup-note order without horizontal overflow", async ({ page }) => {
  await login(page);
  await page.getByRole("searchbox").fill("#11 브라질");
  const beanCard = page.locator("[data-bean-card]").filter({ hasText: "#11 브라질" });
  await beanCard.locator('a[href*="/beans/"]').click();

  await expect(page.getByTestId("bean-cup-notes")).toContainText("초콜릿");
  const followsExpectedOrder = await page.evaluate(() => {
    const ids = [
      "bean-overall-score",
      "bean-cup-notes",
      "bean-origin-info",
      "bean-process-roast-info",
    ];
    const elements = ids.map((id) => document.querySelector(`[data-testid="${id}"]`));
    return elements.every(Boolean) && elements.slice(0, -1).every((element, index) =>
      Boolean(
        element &&
          elements[index + 1] &&
          element.compareDocumentPosition(elements[index + 1]!) &
            Node.DOCUMENT_POSITION_FOLLOWING
      )
    );
  });
  expect(followsExpectedOrder).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
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
    page
      .locator("[data-bean-card]")
      .filter({ hasText: "[QA:native] JS 비활성 저장" })
      .filter({ hasText: "QA Native Roastery" })
      .first()
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
  const filterToggle = page.getByRole("button", { name: "필터" });
  await expect(page.locator("#explore-filter-panel")).toHaveCount(0);
  await filterToggle.click();

  const heights = await page.locator("main select, main button[aria-controls], body > nav a").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height)
  );
  const widths = await page.evaluate(() => {
    const search = document.querySelector<HTMLElement>('main input[type="search"]');
    const filterButton = document.querySelector<HTMLElement>(
      'main button[aria-controls="explore-filter-panel"]'
    );
    const sort = document.querySelector<HTMLElement>('main select[aria-label="정렬"]');
    const detailFilters = Array.from(
      document.querySelectorAll<HTMLElement>("#explore-filter-panel select")
    );
    if (!search || !filterButton || !sort) throw new Error("Missing mobile explore controls");
    return {
      search: search.getBoundingClientRect().width,
      filter: filterButton.getBoundingClientRect().width,
      sort: sort.getBoundingClientRect().width,
      details: detailFilters.map((filter) => filter.getBoundingClientRect().width),
      documentOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  expect(widths.filter).toBeCloseTo(widths.sort, 0);
  expect(widths.details).toHaveLength(6);
  expect(Math.max(...widths.details) - Math.min(...widths.details)).toBeLessThanOrEqual(1);
  expect(widths.documentOverflow).toBe(0);
});
