import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { contentSecurityPolicy } from "./src/lib/security/csp";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isDevelopment = process.env.NODE_ENV === "development";
// 보안 헤더 — 모든 경로에 적용
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Non-HTML assets and API responses have no inline scripts. HTML receives
    // a request-specific nonce policy from the proxy.
    key: "Content-Security-Policy",
    value: contentSecurityPolicy(),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "1mb",
    // Production containers have a read-only root filesystem. Metadata route
    // bodies live under .next/server/app, outside the writable cache mount.
    // Keep the bounded memory cache, but never try to rewrite those image files.
    isrFlushToDisk: isDevelopment,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/ocr/tesseract-7.0.0/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/ocr/paddle-0.4.2-v1/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Only the isolated OCR worker may compile WebAssembly. The page's
        // policy still prohibits eval, and every OCR asset comes from this site.
        source: "/ocr/tesseract-7.0.0/worker.min.js",
        headers: [{
          key: "Content-Security-Policy",
          value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; object-src 'none'",
        }],
      },
      {
        source: "/ocr/paddle-0.4.2-v1/worker.js",
        headers: [{
          key: "Content-Security-Policy",
          value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; object-src 'none'",
        }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
