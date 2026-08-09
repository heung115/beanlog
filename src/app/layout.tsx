import type { Metadata, Viewport } from "next";
import designTokens from "@/config/design-tokens.json";

export const metadata: Metadata = {
  title: "Beanlog",
  description: "My Coffee Bean Journal",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: designTokens.colors.cream,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
