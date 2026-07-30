import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Beanlog",
  description: "My Coffee Bean Journal",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
