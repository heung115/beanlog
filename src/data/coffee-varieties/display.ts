/** Keep evidence qualifiers in research data; public lists contain names only. */
const names: Record<string, string> = {
  "Ethiopian heirloom (unspecified)": "Ethiopian heirloom",
  "Hybrid (unspecified)": "Hybrid",
  "Local Arabica landraces (lot-specific identification needed)": "Local Arabica landraces",
  "Robusta (Coffea canephora; cultivar varies by lot)": "Coffea canephora (Robusta)",
};

export const varietyDisplayName = (name: string): string => names[name] ?? name;
export const varietyDisplayNames = (values: string[]): string[] => [...new Set(values.map(varietyDisplayName))];
