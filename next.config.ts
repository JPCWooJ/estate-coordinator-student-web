import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/matters/*/blueprint/finalize": [
      "./node_modules/@fontsource/arimo/files/arimo-latin-400-normal.woff",
      "./node_modules/@fontsource/arimo/files/arimo-latin-400-italic.woff",
      "./node_modules/@fontsource/arimo/files/arimo-latin-700-normal.woff",
    ],
  },
};

export default nextConfig;
