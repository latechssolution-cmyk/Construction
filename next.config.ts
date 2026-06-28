import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  // Prevent bundling of server-only native modules into the client/edge bundles
  serverExternalPackages: ["mongoose", "pdfkit", "fontkit", "iconv-lite"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // Cache dashboard API responses for 30 seconds (private — user-specific)
      {
        source: "/api/dashboard/:path*",
        headers: [{ key: "Cache-Control", value: "private, max-age=30, stale-while-revalidate=60" }],
      },
      // Light cache for list endpoints — 10 s avoids duplicate requests on tab focus
      {
        source: "/api/(projects|clients|employees|vendors|materials|invoices)",
        headers: [{ key: "Cache-Control", value: "private, max-age=10, stale-while-revalidate=30" }],
      },
    ];
  },
};

export default nextConfig;
