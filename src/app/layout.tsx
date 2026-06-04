import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: "深空回响",
  description: "深夜陪伴日记",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "深空回响",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("h-full", "antialiased", notoSerifSC.variable, "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-[#020617]">
        {/* 全屏星空渐变背景层 - fixed 避免滚动断层 */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#0f172a] via-[#020617] to-[#020617]" />
        {children}
      </body>
    </html>
  );
}
