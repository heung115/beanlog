export interface OriginMapRegion {
  regionId: number | null;
  name: string;
  nameKo: string | null;
  count: number;
}

export interface OriginMapEntry {
  countryId: number | null;
  nameEn: string;
  nameKo: string | null;
  mapped: boolean;
  count: number;
  regions: OriginMapRegion[];
}

export interface BeanStats {
  total: number;
  avgScore: number;
  best: { name: string; roastery: string; score: number };
  byOrigin: [string, number][];
  byProcess: [string, number][];
  byVarietal: [string, number][];
  byMonth: [string, number][];
  scoreDist: [string, number][];
  topOrigin?: [string, number];
  topProcess?: [string, number];
  originMap: OriginMapEntry[];
}
