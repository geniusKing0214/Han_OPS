import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePathRaw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const basePath = basePathRaw ? basePathRaw : undefined;

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  ...(basePath ? { basePath } : {}),
  ...(isStaticExport ? { trailingSlash: true } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
