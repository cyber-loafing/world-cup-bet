import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Bet",
  description: "2026 世界杯情侣竞猜账本",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
