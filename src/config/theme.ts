import designTokens from "@/config/design-tokens.json";

export const beanmapThemes = ["mist", "cream", "contrast"] as const;

export type BeanmapTheme = (typeof beanmapThemes)[number];

export const defaultBeanmapTheme: BeanmapTheme = "mist";

const themeColors: Record<BeanmapTheme, string> = {
  mist: designTokens.colors.cream,
  cream: designTokens.themeOverrides.cream.cream,
  contrast: designTokens.themeOverrides.contrast.cream,
};

export function resolveBeanmapTheme(value = process.env.BEANMAP_THEME): BeanmapTheme {
  const normalized = value?.trim().toLowerCase();

  return beanmapThemes.includes(normalized as BeanmapTheme)
    ? (normalized as BeanmapTheme)
    : defaultBeanmapTheme;
}

export function getBeanmapThemeColor(theme: BeanmapTheme): string {
  return themeColors[theme];
}
