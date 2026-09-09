// Publication holds reflect explicit source restrictions found during the audit,
// not a finding that the underlying geographic or production facts are copyrighted.
export const heldLotSourceHosts = [
  "sucafina.com", "covoyacoffee.com", "onyxcoffeelab.com", "melbournecoffeemerchants.com.au",
];
export function isHeldLotSource(url: string): boolean {
  const parsed = new URL(url);
  return heldLotSourceHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    || (parsed.hostname === "cdn2.assets-servd.host" && parsed.pathname.includes("worldcoffee-research/") && parsed.pathname.endsWith(".pdf"));
}
