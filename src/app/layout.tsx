import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") ?? "";
const manifestPath = basePath ? `${basePath}/manifest.webmanifest` : "/manifest.webmanifest";
const iconBase = basePath ? `${basePath}/icons` : "/icons";

export const metadata: Metadata = {
  title: "HAN OPS — 딜러팀 스케줄",
  description: "딜러팀 전용 스케줄 운영 플랫폼",
  applicationName: "HAN OPS",
  manifest: manifestPath,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HAN OPS",
  },
  icons: {
    icon: [
      { url: `${iconBase}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${iconBase}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${iconBase}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.className} min-h-screen antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
