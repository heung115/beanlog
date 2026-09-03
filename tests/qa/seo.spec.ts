import { expect, test, type Page } from "@playwright/test";

type JsonLdNode = Record<string, unknown>;

async function expectLocalizedAlternates(page: Page, expectedPath: string) {
  const canonicalHref = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(canonicalHref).not.toBeNull();

  const canonical = new URL(canonicalHref!);
  expect(canonical.pathname).toBe(expectedPath);

  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      Object.fromEntries(
        links.map((link) => [
          link.getAttribute("hreflang"),
          link.getAttribute("href"),
        ])
      )
    );

  const suffix = expectedPath.replace(/^\/(?:ko|en)/, "");
  expect(alternates).toEqual({
    ko: `${canonical.origin}/ko${suffix}`,
    en: `${canonical.origin}/en${suffix}`,
  });

  return canonical.origin;
}

async function readJsonLd(page: Page): Promise<JsonLdNode[]> {
  return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => JSON.parse(script.textContent ?? "null"))
  );
}

function flattenJsonLd(nodes: JsonLdNode[]): JsonLdNode[] {
  const flattened: JsonLdNode[] = [];

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;

    const node = value as JsonLdNode;
    flattened.push(node);
    Object.values(node).forEach(visit);
  }

  nodes.forEach(visit);
  return flattened;
}

test("English landing exposes localized, indexable metadata and WebApplication schema", async ({
  page,
}) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("beanmap | Coffee Journal & Origin Guide");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Track coffee beans, roasters, origins, processing methods, tasting notes, and ratings, then explore guides to 20 coffee-producing countries."
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /index.*follow/i
  );

  const origin = await expectLocalizedAlternates(page, "/en");
  const jsonLd = await readJsonLd(page);
  expect(jsonLd.some((schema) => schema["@context"] === "https://schema.org")).toBe(
    true
  );
  const schemas = flattenJsonLd(jsonLd);
  const webApplication = schemas.find(
    (schema) => schema["@type"] === "WebApplication"
  );

  expect(webApplication).toMatchObject({
    "@type": "WebApplication",
    name: "beanmap",
    url: `${origin}/en`,
    inLanguage: "en",
  });
});

test("English origin index and detail expose localized metadata and structured data", async ({
  page,
}) => {
  let response = await page.goto("/en/origins");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(
    "Coffee Origin Guide: 20 Producing Countries | beanmap"
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /20 coffee-producing countries/i
  );
  await expectLocalizedAlternates(page, "/en/origins");

  const indexSchemas = flattenJsonLd(await readJsonLd(page));
  expect(indexSchemas.some((schema) => schema["@type"] === "CollectionPage")).toBe(
    true
  );
  expect(indexSchemas.some((schema) => schema["@type"] === "ItemList")).toBe(true);

  response = await page.goto("/en/origins/ethiopia");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Ethiopia Coffee Origin Guide | beanmap");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Ethiopia coffee/i
  );
  await expectLocalizedAlternates(page, "/en/origins/ethiopia");

  const detailSchemas = flattenJsonLd(await readJsonLd(page));
  expect(detailSchemas.some((schema) => schema["@type"] === "WebPage")).toBe(true);
  expect(
    detailSchemas.some((schema) => schema["@type"] === "BreadcrumbList")
  ).toBe(true);
});

test("robots and sitemap expose the localized public discovery surface", async ({
  page,
}) => {
  await page.goto("/en");
  const canonicalHref = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(canonicalHref).not.toBeNull();
  const origin = new URL(canonicalHref!).origin;

  const robotsResponse = await page.request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
  const robots = await robotsResponse.text();
  expect(robots).toContain("User-Agent: *");
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Disallow: /_deploy/");
  expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);

  const sitemapResponse = await page.request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers()["content-type"]).toContain("xml");
  const sitemap = await sitemapResponse.text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => location
  );

  expect(locations).toContain(`${origin}/ko`);
  expect(locations).toContain(`${origin}/en`);
  expect(locations).toContain(`${origin}/ko/origins`);
  expect(locations).toContain(`${origin}/en/origins`);
  expect(locations).toContain(`${origin}/ko/origins/ethiopia`);
  expect(locations).toContain(`${origin}/en/origins/ethiopia`);
  expect(sitemap).toContain('hreflang="ko"');
  expect(sitemap).toContain('hreflang="en"');

  const socialImageResponse = await page.request.get("/opengraph-image", {
    maxRedirects: 0,
  });
  expect(socialImageResponse.status()).toBe(200);
  expect(socialImageResponse.headers()["content-type"]).toContain("image/png");
});
