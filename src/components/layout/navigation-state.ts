export const primaryNavigationHrefs = [
  "/explore",
  "/beans/new",
  "/origins",
  "/stats",
  "/settings",
] as const;

export type PrimaryNavigationHref = (typeof primaryNavigationHrefs)[number];

export function getAppPathname(pathname: string): string {
  const pathnameOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const appPathname = pathnameOnly.replace(/^\/(ko|en)(?=\/|$)/, "") || "/";

  return appPathname.length > 1 ? appPathname.replace(/\/+$/, "") : appPathname;
}

function isPathWithin(appPathname: string, href: string): boolean {
  return appPathname === href || appPathname.startsWith(`${href}/`);
}

export function isNavigationItemActive(
  appPathname: string,
  href: PrimaryNavigationHref
): boolean {
  if (href === "/explore") {
    const isBeanDetail =
      appPathname.startsWith("/beans/") && !isPathWithin(appPathname, "/beans/new");

    return isPathWithin(appPathname, href) || isBeanDetail;
  }

  return isPathWithin(appPathname, href);
}

export function navigationAriaCurrent(
  appPathname: string,
  href: PrimaryNavigationHref
): "page" | undefined {
  return isNavigationItemActive(appPathname, href) ? "page" : undefined;
}
