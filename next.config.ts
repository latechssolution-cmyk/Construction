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
  // pdfkit reads its built-in font metrics (Helvetica.afm etc.) from disk at
  // runtime via fs, not via require/import — Vercel's file tracer can't see
  // that dependency automatically, so the two PDF-generating routes throw
  // ENOENT for the .afm files in production even though `npm run build`
  // and local dev both work fine (dev reads straight from node_modules).
  outputFileTracingIncludes: {
    "/api/projects/[id]/report": ["./node_modules/pdfkit/js/data/**"],
    "/api/invoices/[id]/pdf": ["./node_modules/pdfkit/js/data/**"],
  },
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
      // No HTTP-level caching on API responses. These endpoints were
      // previously cached for 10-30s via Cache-Control — but SWR's mutate()
      // (called after every create/update/delete) triggers a `fetch()` to
      // the same URL expecting a fresh network response, and the browser's
      // HTTP cache would silently serve the pre-edit cached response instead
      // for up to that window. Client-side caching/deduping is already
      // handled by SWR's own dedupingInterval, so no HTTP cache is needed.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
