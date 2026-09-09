import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These image build/probe scripts run directly as CommonJS in Node.
    files: ["ops/production/runtime-image-patches/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "qa-report/**",
    "test-results/**",
    ".staging/**",
    "public/ocr/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
