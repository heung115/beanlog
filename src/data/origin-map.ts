import { geoCentroid } from "d3";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
  GeometryCollection,
  Topology,
} from "topojson-specification";
import type { OriginMapEntry } from "@/types/stats";

type CountryProperties = { name?: string };
type CountryFeature = Feature<Geometry, CountryProperties>;
type WorldTopology = Topology<{
  countries: GeometryCollection<CountryProperties>;
  land: GeometryCollection;
}>;

const topology = world as unknown as WorldTopology;
const countryCollection = feature(
  topology,
  topology.objects.countries
) as FeatureCollection<Geometry, CountryProperties>;

export const originMapCountries: readonly CountryFeature[] =
  countryCollection.features;

function normalizeCountryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const countryByName = new Map(
  originMapCountries.flatMap((country) => {
    const name = country.properties?.name;
    return name ? [[normalizeCountryName(name), country] as const] : [];
  })
);

const featureNameAliases: Readonly<Record<string, string>> = {
  "bolivia plurinational state of": "bolivia",
  "central african republic": "central african rep",
  "china taiwan province of": "taiwan",
  "congo kinshasa": "dem rep congo",
  "democratic republic of congo": "dem rep congo",
  "democratic republic of the congo": "dem rep congo",
  "dominican republic": "dominican rep",
  "dr congo": "dem rep congo",
  "east timor": "timor leste",
  "equatorial guinea": "eq guinea",
  "iran islamic republic of": "iran",
  "ivory coast": "cote d ivoire",
  "korea republic of": "south korea",
  "lao peoples democratic republic": "laos",
  "lao pdr": "laos",
  "myanmar burma": "myanmar",
  "republic of congo": "congo",
  "republic of the congo": "congo",
  "solomon islands": "solomon is",
  "south sudan": "s sudan",
  "tanzania united republic of": "tanzania",
  "the gambia": "gambia",
  "united republic of tanzania": "tanzania",
  "united states": "united states of america",
  "united states hawaii": "united states of america",
  "united states puerto rico": "puerto rico",
  "venezuela bolivarian republic of": "venezuela",
  "viet nam": "vietnam",
};

const pointOverrides: Readonly<Record<string, readonly [number, number]>> = {
  mauritius: [57.55, -20.2],
  "united states hawaii": [-155.5, 19.6],
  "united states puerto rico": [-66.5, 18.2],
};

function sourceName(entry: OriginMapEntry): string {
  return normalizeCountryName(entry.nameEn);
}

function featureName(entry: OriginMapEntry): string {
  const normalized = sourceName(entry);
  return featureNameAliases[normalized] ?? normalized;
}

function getOriginMapFeature(entry: OriginMapEntry): CountryFeature | null {
  if (!entry.nameEn.trim()) return null;
  return countryByName.get(featureName(entry)) ?? null;
}

export function getOriginMapFeatureName(entry: OriginMapEntry): string | null {
  return getOriginMapFeature(entry)?.properties?.name ?? null;
}

export function getOriginMapPoint(
  entry: OriginMapEntry
): [number, number] | null {
  if (!entry.nameEn.trim()) return null;

  const override = pointOverrides[sourceName(entry)];
  if (override) return [override[0], override[1]];

  const country = getOriginMapFeature(entry);
  if (!country) return null;

  const point = geoCentroid(country);
  return point.every(Number.isFinite) ? point : null;
}

export function isOriginPlottable(entry: OriginMapEntry): boolean {
  return getOriginMapPoint(entry) !== null;
}
