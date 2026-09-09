import { extendedVarietyGuides } from "./extended.ts";
import { coreVarietyGuides } from "./core.ts";
import { specialtyVarietyGuides } from "./specialty.ts";
import { regionalVarietyGuides } from "./regional.ts";
import { populationVarietyGuides } from "./populations.ts";
import { buildVarietyGuideIndex, matchVarietyGuides } from "./model.ts";

export const coffeeVarietyGuides = [...coreVarietyGuides, ...specialtyVarietyGuides, ...regionalVarietyGuides, ...populationVarietyGuides, ...extendedVarietyGuides];
export const coffeeVarietyGuideIndex = buildVarietyGuideIndex(coffeeVarietyGuides);
export const getVarietyGuides = (names: string[]) => matchVarietyGuides(names, coffeeVarietyGuideIndex);
