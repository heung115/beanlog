import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const moduleRoot = new URL("../", import.meta.url);
let moduleSequence = 0;

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, moduleRoot), "utf8");
}

function transpile(relativePath) {
  const result = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: relativePath,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );

  assert.deepEqual(
    errors.map((diagnostic) => diagnostic.messageText),
    [],
    `${relativePath} should transpile without syntax errors`
  );

  return result.outputText;
}

function asModuleUrl(source) {
  moduleSequence += 1;
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${moduleSequence}`;
}

function replaceImports(source, replacements) {
  let result = source;

  for (const [specifier, replacement] of Object.entries(replacements)) {
    result = result
      .split(`"${specifier}"`)
      .join(`"${replacement}"`)
      .split(`'${specifier}'`)
      .join(`'${replacement}'`);
    assert.doesNotMatch(result, new RegExp(`from ["']${specifier}["']`));
  }

  return result;
}

const seoModuleUrl = asModuleUrl(transpile("src/lib/seo.ts"));
const seo = await import(seoModuleUrl);
const originModuleUrl = asModuleUrl(transpile("src/data/origin-presets.ts"));
const origins = await import(originModuleUrl);
const sitemapModule = await import(
  asModuleUrl(
    replaceImports(transpile("src/app/sitemap.ts"), {
      "@/data/origin-presets": originModuleUrl,
      "@/lib/seo": seoModuleUrl,
    })
  )
);
const robotsModule = await import(
  asModuleUrl(
    replaceImports(transpile("src/app/robots.ts"), {
      "@/lib/seo": seoModuleUrl,
    })
  )
);

test("site origins are normalized to an HTTP(S) origin with a production fallback", () => {
  assert.equal(
    seo.normalizeSiteOrigin(undefined),
    "https://beanmap.site"
  );
  assert.equal(seo.normalizeSiteOrigin(""), "https://beanmap.site");
  assert.equal(
    seo.normalizeSiteOrigin("not a URL"),
    "https://beanmap.site"
  );
  assert.equal(
    seo.normalizeSiteOrigin("ftp://beanmap.site"),
    "https://beanmap.site"
  );
  assert.equal(
    seo.normalizeSiteOrigin("https://user:pass@beanmap.site/path"),
    "https://beanmap.site"
  );
  assert.equal(
    seo.normalizeSiteOrigin(" HTTPS://Example.COM:443/path?q=1#section "),
    "https://example.com"
  );
  assert.equal(
    seo.normalizeSiteOrigin("http://localhost:3100/a/path"),
    "http://localhost:3100"
  );
});

test("absolute URL construction cannot escape the configured origin", () => {
  const origin = "https://preview.example:8443/base";
  const normal = seo.absoluteUrl("/en/origins", origin);
  const protocolRelative = seo.absoluteUrl("//attacker.example/phish", origin);
  const absoluteInput = seo.absoluteUrl("https://attacker.example/phish", origin);

  assert.equal(normal, "https://preview.example:8443/en/origins");
  assert.equal(new URL(protocolRelative).origin, "https://preview.example:8443");
  assert.equal(new URL(absoluteInput).origin, "https://preview.example:8443");
});

test("landing and origin metadata are localized, canonical, reciprocal, and public", () => {
  const koreanLanding = seo.buildLandingMetadata("ko");
  const englishLanding = seo.buildLandingMetadata("en");
  const englishIndex = seo.buildOriginIndexMetadata("en");

  assert.match(koreanLanding.title, /커피/);
  assert.match(englishLanding.title, /Coffee Journal/);
  assert.notEqual(koreanLanding.description, englishLanding.description);
  assert.equal(koreanLanding.alternates.canonical, seo.localizedUrl("ko"));
  assert.equal(englishLanding.alternates.canonical, seo.localizedUrl("en"));
  assert.deepEqual(
    Object.keys(englishLanding.alternates.languages).sort(),
    ["en", "ko"]
  );
  assert.equal(englishLanding.alternates.languages["x-default"], undefined);
  assert.equal(
    englishIndex.alternates.canonical,
    seo.localizedUrl("en", "/origins")
  );
  assert.deepEqual(englishIndex.robots, { index: true, follow: true });
  assert.equal(koreanLanding.manifest, "/manifest.json?lang=ko");
  assert.equal(englishLanding.manifest, "/manifest.json?lang=en");
  assert.equal(englishIndex.manifest, "/manifest.json?lang=en");

  for (const metadata of [koreanLanding, englishLanding, englishIndex]) {
    const openGraphImage = metadata.openGraph.images[0].url;
    const twitterImage = metadata.twitter.images[0].url;

    assert.equal(new URL(openGraphImage).origin, seo.SITE_ORIGIN);
    assert.equal(new URL(twitterImage).origin, seo.SITE_ORIGIN);
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  }
});

test("locale defaults are localized and keep non-public routes out of search", () => {
  const korean = seo.buildLocaleDefaultMetadata("ko");
  const english = seo.buildLocaleDefaultMetadata("en");

  assert.match(korean.title, /커피/);
  assert.match(english.title, /Coffee Journal/);
  assert.notEqual(korean.description, english.description);
  assert.equal(korean.manifest, "/manifest.json?lang=ko");
  assert.equal(english.manifest, "/manifest.json?lang=en");
  assert.deepEqual(korean.robots, { index: false, follow: true });
  assert.deepEqual(english.robots, { index: false, follow: true });

  const localeLayout = read("src/app/[locale]/layout.tsx");
  assert.match(localeLayout, /export async function generateMetadata/);
  assert.match(localeLayout, /buildLocaleDefaultMetadata\(locale\)/);
});

test("origin detail metadata uses the canonical preset slug and localized facts", () => {
  const preset = origins.originPresets[0];
  const slug = origins.originSlug(preset.country);
  const korean = seo.buildOriginDetailMetadata("ko", preset, slug);
  const english = seo.buildOriginDetailMetadata("en", preset, slug);

  assert.match(korean.title, new RegExp(preset.countryKo));
  assert.match(korean.description, new RegExp(preset.signatureKo));
  assert.match(english.title, new RegExp(preset.country));
  assert.match(english.description, new RegExp(preset.signature));
  assert.equal(
    korean.alternates.canonical,
    seo.localizedUrl("ko", `/origins/${slug}`)
  );
  assert.equal(
    english.alternates.canonical,
    seo.localizedUrl("en", `/origins/${slug}`)
  );
  assert.deepEqual(korean.alternates.languages, english.alternates.languages);
  assert.equal(korean.manifest, "/manifest.json?lang=ko");
  assert.equal(english.manifest, "/manifest.json?lang=en");
});

test("JSON-LD serialization preserves data without leaving script-breaking text", () => {
  const input = {
    name: "beanmap",
    unsafe: "</script><script>alert('x')</script>",
    separators: "line\u2028paragraph\u2029end",
  };
  const serialized = seo.serializeJsonLd(input);

  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.match(serialized, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(serialized), input);
  assert.equal(seo.serializeJsonLd(undefined), "null");
});

test("sitemap has exactly the 44 localized public URLs and reciprocal alternates", () => {
  const entries = sitemapModule.default();
  const detailPaths = origins.originPresets.map(
    (preset) => `/origins/${origins.originSlug(preset.country)}`
  );
  const expectedPaths = ["", "/origins", ...detailPaths];
  const expectedUrls = expectedPaths.flatMap((path) => [
    seo.localizedUrl("ko", path),
    seo.localizedUrl("en", path),
  ]);

  assert.equal(origins.originPresets.length, 20);
  assert.equal(entries.length, 44);
  assert.equal(new Set(entries.map((entry) => entry.url)).size, 44);
  assert.deepEqual(
    new Set(entries.map((entry) => entry.url)),
    new Set(expectedUrls)
  );

  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ["alternates", "url"]);
    assert.deepEqual(
      Object.keys(entry.alternates.languages).sort(),
      ["en", "ko"]
    );
    assert.equal(entry.alternates.languages["x-default"], undefined);
    assert.equal("lastModified" in entry, false);
    assert.equal("changeFrequency" in entry, false);
    assert.equal("priority" in entry, false);
  }
});

test("robots allows public pages, protects internal routes, and names the sitemap", () => {
  const robots = robotsModule.default();

  assert.deepEqual(robots.rules, {
    userAgent: "*",
    allow: "/",
    disallow: ["/api/", "/_deploy/"],
  });
  assert.equal(robots.sitemap, seo.absoluteUrl("/sitemap.xml"));
  assert.equal(robots.host, seo.SITE_ORIGIN);
});

test("root and social-image metadata keep stable generic contracts", () => {
  const layout = read("src/app/layout.tsx");
  const socialImage = read("src/app/opengraph-image.tsx");

  assert.match(layout, /metadataBase:\s*new URL\(SITE_ORIGIN\)/);
  assert.doesNotMatch(layout, /template\s*:/);
  assert.match(layout, /title:\s*"beanmap — Coffee Journal & Origin Guide"/);
  assert.match(socialImage, /width:\s*1200/);
  assert.match(socialImage, /height:\s*630/);
  assert.match(socialImage, /contentType\s*=\s*"image\/png"/);
});
