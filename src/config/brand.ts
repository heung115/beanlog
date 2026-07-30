export const brand = {
  name: "Beanlog",
  tagline: {
    ko: "나의 커피 원두 기록",
    en: "My Coffee Bean Journal",
  },
  colors: {
    cream: "#FAF7F2",
    brown: "#3E2F23",
    brownLight: "#8B7355",
    brownMedium: "#6B5744",
    accent: "#A0785A",
    border: "#E8E0D5",
  },
} as const;

export type Brand = typeof brand;
