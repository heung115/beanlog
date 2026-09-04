import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function linkOpenings(value) {
  return value.match(/<Link\b[\s\S]*?>/g) ?? [];
}

function assertPrefetchDisabled(links, label) {
  assert.ok(links.length > 0, `${label} must contain at least one Link`);
  for (const link of links) {
    assert.match(link, /\bprefetch=\{false\}/, `${label}: ${link}`);
  }
}

test("authenticated navigation does not prefetch protected routes through session middleware", () => {
  const topBar = source("src/components/layout/top-bar.tsx");
  const publicBranchEnd = topBar.indexOf("  const links = [");
  assert.ok(publicBranchEnd > 0, "expected separate public and authenticated nav branches");

  const publicLinks = linkOpenings(topBar.slice(0, publicBranchEnd));
  assert.ok(publicLinks.length > 0, "expected public top-bar links");
  assert.ok(
    publicLinks.every((link) => !/\bprefetch=\{false\}/.test(link)),
    "public navigation links should keep Next prefetch for discoverable routes"
  );

  const authenticatedTopBar = topBar.slice(publicBranchEnd);
  assert.match(authenticatedTopBar, /href: "\/explore"[^\n]+prefetch: false/);
  assert.match(authenticatedTopBar, /href: "\/beans\/new"[^\n]+prefetch: false/);
  assert.match(authenticatedTopBar, /href: "\/stats"[^\n]+prefetch: false/);
  assert.match(authenticatedTopBar, /href: "\/settings"[^\n]+prefetch: false/);
  assert.match(authenticatedTopBar, /href: "\/origins", label: t\("origins"\) \},/);
  assert.match(authenticatedTopBar, /prefetch=\{prefetch\}/);
  assert.equal(
    linkOpenings(authenticatedTopBar).filter((link) => /prefetch=\{false\}/.test(link)).length,
    2,
    "the protected logo and account links should opt out explicitly"
  );

  const bottomNav = source("src/components/layout/bottom-nav.tsx");
  assert.match(bottomNav, /href: "\/explore"[^\n]+prefetch: false/);
  assert.match(bottomNav, /href: "\/beans\/new"[^\n]+prefetch: false/);
  assert.match(bottomNav, /href: "\/stats"[^\n]+prefetch: false/);
  assert.match(bottomNav, /href: "\/settings"[^\n]+prefetch: false/);
  assert.match(bottomNav, /href: "\/origins", label: t\("origins"\), icon: OriginIcon \},/);
  assert.match(bottomNav, /prefetch=\{prefetch\}/);
});

test("bean cards do not prefetch every protected detail route in view", () => {
  assertPrefetchDisabled(
    linkOpenings(source("src/components/beans/bean-card.tsx")),
    "bean card detail link"
  );
});

test("protected and high-density links avoid auth prefetch fan-out without losing public hrefs", () => {
  assertPrefetchDisabled(
    linkOpenings(source("src/components/beans/empty-journal-guide.tsx")),
    "shared empty-journal action"
  );

  const explore = source("src/app/[locale]/explore/explore-client.tsx");
  const stats = source("src/app/[locale]/stats/page.tsx");
  for (const [page, label] of [[explore, "explore"], [stats, "stats"]]) {
    assert.match(page, /<EmptyJournalGuide\b[\s\S]*?href=\{`\/\$\{locale\}\/beans\/new`\}/);
    assert.ok(page.includes("EmptyJournalGuide"), `${label} should use the shared empty guide`);
  }
  assertPrefetchDisabled(
    linkOpenings(source("src/app/[locale]/beans/[id]/edit/page.tsx")),
    "edit not-found link"
  );

  const detailLinks = linkOpenings(
    source("src/app/[locale]/beans/[id]/page.tsx")
  );
  const protectedLinks = detailLinks.filter((link) =>
    /\/explore/.test(link)
  );
  const publicOriginLinks = detailLinks.filter((link) =>
    /\/origins\//.test(link)
  );
  assertPrefetchDisabled(protectedLinks, "bean detail back link");
  assert.ok(publicOriginLinks.length > 0, "expected public origin guide links");
  assert.ok(
    publicOriginLinks.every((link) => !/\bprefetch=\{false\}/.test(link)),
    "public origin guide links should keep Next prefetch"
  );

  const originHubLinks = linkOpenings(
    source("src/app/[locale]/origins/page.tsx")
  ).filter((link) => /\/origins\/\$\{originSlug/.test(link));
  assertPrefetchDisabled(
    originHubLinks,
    "high-density public origin hub links"
  );
  assert.ok(
    originHubLinks.every((link) => /href=\{`\/\$\{locale\}\/origins\//.test(link)),
    "disabling prefetch must preserve crawlable origin hrefs"
  );
});
