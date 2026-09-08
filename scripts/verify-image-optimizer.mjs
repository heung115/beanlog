/**
 * Anonymous, read-only image-boundary regression; no QA globalSetup or accounts.
 * Run against an already-built local Next server:
 *   BEANMAP_IMAGE_VERIFY_URL=http://127.0.0.1:PORT node scripts/verify-image-optimizer.mjs
 * After an authorized deployment, the same checks may target the public host:
 *   BEANMAP_IMAGE_VERIFY_PUBLIC=authorized BEANMAP_IMAGE_VERIFY_URL=https://beanmap.site node scripts/verify-image-optimizer.mjs
 * The Blob check probes the real document's CSP and browser decoder. Actual
 * authenticated photo-input behavior is checked separately on /ko/beans/new.
 */
import { chromium, expect, request } from "@playwright/test";

const target = new URL(process.env.BEANMAP_IMAGE_VERIFY_URL ?? "http://127.0.0.1:3100");
const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
const publicAuthorized = target.origin === "https://beanmap.site"
  && process.env.BEANMAP_IMAGE_VERIFY_PUBLIC === "authorized";
if ((!loopback && !publicAuthorized) || target.username || target.password
  || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Use a loopback server origin or explicitly authorize the public read-only check.");
}
process.umask(0o077);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const checks = [
  ["canonical", "/_next/image?url=/icon-192.png&w=64&q=75", "image/avif,image/webp,*/*"],
  ["encoded source", "/_next/image?url=%2Ficon-192.png&w=64&q=75", "image/avif"],
  ["mixed-case AVIF accept", "/_next/image?url=%2ficon-192.png&w=64&q=75", "IMAGE/AVIF,image/png;q=0.8"],
  ["AVIF accept mixed type", "/_next/image?url=/icon-192.png&w=64&q=75", "image/AvIf,*/*;q=0.5"],
  ["PNG accept", "/_next/image?url=/icon-192.png&w=64&q=75", "image/png"],
  ["encoded filename", "/_next/image?url=%2F%69con-192.png&w=64&q=75", "image/avif"],
  ["double-encoded source", "/_next/image?url=%252Ficon-192.png&w=64&q=75", "image/avif"],
  ["encoded optimizer name", "/_next/%69mage?url=%2Ficon-192.png&w=64&q=75", "image/avif"],
  ["encoded next prefix", "/%5Fnext/image?url=%2Ficon-192.png&w=64&q=75", "image/avif"],
  ["case-changed optimizer name", "/_next/Image?url=%2Ficon-192.png&w=64&q=75", "image/avif"],
  ["remote source", "/_next/image?url=https%3A%2F%2Fexample.invalid%2Fimage.png&w=64&q=75", "image/avif"],
  ["data source", "/_next/image?url=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgo%3D&w=64&q=75", "image/avif"],
  ["private loopback source", "/_next/image?url=http%3A%2F%2F127.0.0.1%3A9%2Fimage.png&w=64&q=75", "image/avif"],
  ["private IPv6 source", "/_next/image?url=http%3A%2F%2F%5B%3A%3A1%5D%3A9%2Fimage.png&w=64&q=75", "image/avif"],
];
let browser;
let http;
let failures = 0;
const report = (check, status, extra = {}) => console.log(JSON.stringify({ check, status, ...extra }));

try {
  http = await request.newContext({ baseURL: target.origin, timeout: 20000 });
  const original = await http.get("/icon-192.png", { maxRedirects: 0 });
  const originalBytes = await original.body();
  const originalPassed = original.status() === 200
    && /image\/png/i.test(original.headers()["content-type"] ?? "")
    && originalBytes.subarray(0, 8).equals(pngSignature);
  report("original public PNG remains available", originalPassed ? "PASS" : "FAIL", { httpStatus: original.status() });
  if (!originalPassed) failures++;

  for (const [name, path, accept] of checks) {
    let response = await http.get(path, { headers: { accept }, maxRedirects: 0 });
    const initialStatus = response.status();
    // Without Caddy, next-intl localizes this encoded prefix once. Require the
    // exact same-origin localized path to end at 404; never follow arbitrary
    // locations. The public ingress must deny it immediately with 404.
    if (loopback && name === "encoded next prefix" && initialStatus === 307) {
      const location = new URL(response.headers().location ?? "", target.origin);
      expect(location.origin).toBe(target.origin);
      expect(location.pathname).toMatch(/^\/(ko|en)\/_next\/image$/);
      expect(response.headers()["content-type"] ?? "").not.toMatch(/^image\//i);
      response = await http.get(location.toString(), { headers: { accept }, maxRedirects: 0 });
    }
    const passed = response.status() === 404;
    report(`optimizer disabled: ${name}`, passed ? "PASS" : "FAIL", { httpStatus: response.status(), initialStatus });
    if (!passed) failures++;
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const document = await page.goto(target.origin + "/ko/login");
  expect(document?.status()).toBe(200);
  expect(document?.headers()["content-security-policy"]).toMatch(/img-src[^;]*blob:/);
  const imageResult = await page.evaluate(async () => {
    const response = await fetch("/icon-192.png");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.alt = "Temporary image regression probe";
    img.src = url;
    document.body.append(img);
    try {
      await img.decode();
      return { blobUrl: img.src.startsWith("blob:"), width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      img.remove();
      URL.revokeObjectURL(url);
    }
  });
  expect(imageResult).toEqual({ blobUrl: true, width: 192, height: 192 });
  report("public-document CSP permits browser Blob PNG decoding", "PASS");
} catch (error) {
  // Do not dump response bodies, document contents or navigation URLs.
  report("image regression harness", "FAIL", { errorType: error.name });
  failures++;
} finally {
  if (browser) await browser.close();
  if (http) await http.dispose();
}
process.exitCode = failures ? 1 : 0;
