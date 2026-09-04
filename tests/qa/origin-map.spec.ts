import { expect, test, type Locator, type Page } from "@playwright/test";
import { qaUser } from "./helpers";

async function login(page: Page) {
  await page.goto("/ko/login");
  await page.locator('input[name="email"]').fill(qaUser.email);
  await page.locator('input[name="password"]').fill(qaUser.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(?:ko\/)?explore$/);
}

async function mapScale(map: Locator) {
  const transform = await map
    .locator(".origin-map-layer")
    .getAttribute("transform");
  const match = transform?.match(/scale\(([^)]+)\)/);
  if (!match) throw new Error(`Missing map scale in ${transform}`);
  return Number(match[1]);
}

async function waitForScrollToSettle(page: Page) {
  await page.evaluate(async () => {
    let previousY = window.scrollY;
    let stableFrames = 0;

    for (let frame = 0; frame < 120 && stableFrames < 6; frame += 1) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      const currentY = window.scrollY;
      stableFrames = Math.abs(currentY - previousY) < 0.5 ? stableFrames + 1 : 0;
      previousY = currentY;
    }
  });
}

async function hoverMap(page: Page, map: Locator) {
  await map.evaluate((element) => {
    element.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await waitForScrollToSettle(page);
  await map.hover();
  await waitForScrollToSettle(page);
}

test("stats origin map stays legible, searchable, and smoothly zoomable", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ko/stats");

  const map = page.getByRole("img", {
    name: /커피 기록이 있는 산지를 원으로 표시한 세계 지도/,
  });
  await expect(map).toBeVisible();
  await expect(map.locator("path").first()).toHaveAttribute(
    "fill",
    "var(--color-brown-light)"
  );
  await expect(map.locator('[data-origin-country="Bolivia"]')).toHaveCount(1);

  const zoomIn = page.getByRole("button", { name: "지도 확대" });
  const zoomOut = page.getByRole("button", { name: "지도 축소" });
  for (const control of [zoomIn, zoomOut]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await hoverMap(page, map);

  const initialScroll = await page.evaluate(() => window.scrollY);
  const initialScale = await mapScale(map);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(
    initialScroll
  );
  expect(await mapScale(map)).toBeCloseTo(initialScale, 4);

  await hoverMap(page, map);
  const zoomScroll = await page.evaluate(() => window.scrollY);
  const beforeZoom = await mapScale(map);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  await page.waitForTimeout(48);
  const midZoom = await mapScale(map);
  await page.waitForTimeout(180);
  const finishedZoom = await mapScale(map);

  expect(midZoom).toBeGreaterThan(beforeZoom);
  expect(finishedZoom).toBeGreaterThan(midZoom);
  expect(await page.evaluate(() => window.scrollY)).toBe(zoomScroll);

  await page.getByRole("button", { name: "산지 찾기" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "산지 검색" }).fill("Bolivia");
  await dialog.getByRole("button", { name: /Bolivia/ }).click();
  await expect(dialog.getByRole("heading", { name: "Bolivia" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "전체" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "산지 찾기" })).toBeFocused();
});

test("@mobile origin finder is a bounded top-layer sheet", async ({ page }) => {
  await login(page);
  await page.goto("/ko/stats");

  const map = page.getByRole("img", {
    name: /커피 기록이 있는 산지를 원으로 표시한 세계 지도/,
  });
  await expect(map).toBeVisible();
  const mapBox = await map.boundingBox();
  expect(mapBox?.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.getByRole("button", { name: "산지 찾기" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  const sheetBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  if (!sheetBox || !viewport) throw new Error("Missing mobile sheet bounds");

  expect(sheetBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(sheetBox.height).toBeLessThanOrEqual(viewport.height * 0.7 + 1);
  expect(Math.abs(sheetBox.y + sheetBox.height - viewport.height)).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
      .slice(0, 12),
  }));
  expect(overflow.documentWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.viewport
  );
  expect(
    await page.evaluate(() => Boolean(document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight - 2
    )?.closest("dialog")))
  ).toBe(true);

  for (const name of ["산지 검색", "닫기"]) {
    const control = dialog.getByRole(name === "산지 검색" ? "searchbox" : "button", {
      name,
    });
    const controlBox = await control.boundingBox();
    expect(controlBox?.height).toBeGreaterThanOrEqual(44);
  }
});
