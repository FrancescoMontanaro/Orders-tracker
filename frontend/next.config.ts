import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   output: 'standalone',
   // Local dev only: proxy /api to the local backend so the app works from
   // localhost AND from LAN devices without hardcoding the machine's IP
   // (mirrors what nginx does in production). No-op in production builds.
   async rewrites() {
      if (process.env.NODE_ENV !== 'development') return [];
      return [
         {
            source: '/api/:path*',
            destination: 'http://localhost:8000/api/:path*',
         },
      ];
   },
};

export default nextConfig;
