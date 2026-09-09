import { expect, test } from "@playwright/test";

test("nonce CSP allows hydration and structured data while blocking injected inline scripts", async ({ page, request }) => {
  const scriptErrors: string[] = [];
  page.on("pageerror", error => scriptErrors.push(error.message));
  const response = await page.goto("/en?loggedOut=1");
  const policy = response!.headers()["content-security-policy"];
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy.split("; ").find(value => value.startsWith("script-src "))).not.toContain("'unsafe-inline'");
  expect(response!.headers()["cache-control"]).toContain("no-store");
  // This URL marker is consumed by a React effect, proving bootstrap/hydration ran.
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("status")).toBeVisible();
  const scripts = await page.locator("script").evaluateAll(elements => elements.map(element => ({
    nonce: (element as HTMLScriptElement).nonce, inline: !(element as HTMLScriptElement).src,
  })));
  expect(scripts.some(script => script.inline)).toBe(true);
  expect(scripts.every(script => script.nonce === nonce)).toBe(true);
  const repeated = await request.get("/en");
  expect(repeated.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);

  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.documentElement.dataset.injectedScript = 'executed'";
    document.body.append(script);
  });
  await expect(page.locator("html")).not.toHaveAttribute("data-injected-script");
  expect(scriptErrors).toEqual([]);
});

test("origin structured data and the isolated OCR worker keep their intended policies", async ({ page, request }) => {
  for (const path of ["/ko/origins", "/en/origins/ethiopia"]) {
    const response = await page.goto(path);
    const nonce = response!.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
    expect(await page.locator('script[type="application/ld+json"]').evaluate(element => (element as HTMLScriptElement).nonce)).toBe(nonce);
  }
  for (const path of ["/ocr/tesseract-7.0.0/worker.min.js", "/ocr/paddle-0.4.2-v1/worker.js", "/ocr/paddle-0.4.2-v2/worker.js"]) {
    const worker = await request.get(path);
    expect(worker.ok()).toBe(true);
    expect(worker.headers()["content-security-policy"]).toContain("'wasm-unsafe-eval'");
    expect(worker.headers()["content-security-policy"]).not.toContain("'unsafe-inline'");
    expect(worker.headers()["cache-control"]).toContain("immutable");
  }
});
