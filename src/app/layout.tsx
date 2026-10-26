import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
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
    <html lang="zh-CN" suppressHydrationWarning className={cn("h-full", "antialiased", notoSerifSC.variable, "font-sans", geist.variable)}>
      <head>
        {/* 首屏防闪：在 React 水合前就把主题写进 html[data-theme] */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('diary-theme');document.documentElement.dataset.theme=(t==='doodle'||t==='kawaii'||t==='space')?t:'space';}catch(e){document.documentElement.dataset.theme='space';}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-page">
        {/* 全屏渐变背景层 - fixed 避免滚动断层；颜色随主题变量变化 */}
        <div className="fixed inset-0 -z-10" style={{ background: "var(--t-page-gradient)" }} />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
