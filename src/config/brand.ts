export const brand = {
  name: "beanmap",
  tagline: {
    ko: "나의 커피 원두 기록",
    en: "My Coffee Bean Journal",
  },
} as const;

export type Brand = typeof brand;
