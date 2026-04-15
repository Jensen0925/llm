import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/contracts"],
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  async rewrites() {
    return [
      {
        source: "/api/langchain/:path*",
        destination: "http://localhost:3001/api/langchain/:path*",
      },
      {
        source: "/api/memory/:path*",
        destination: "http://localhost:3001/api/memory/:path*",
      },
      {
        source: "/api/files/:path*",
        destination: "http://localhost:3001/api/files/:path*",
      },
      {
        source: "/api/embedding/:path*",
        destination: "http://localhost:3001/api/embedding/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
