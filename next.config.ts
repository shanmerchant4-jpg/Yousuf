import type { NextConfig } from "next";

// Security headers applied to every response.
// CSP notes:
//   - 'unsafe-inline' for style-src is required by Next.js (it injects inline
//     styles for fonts and critical CSS during SSR). Remove once Next ships
//     nonce-based style injection support.
//   - script-src is locked to 'self' only; there are no external CDN scripts.
//   - connect-src allows the Supabase project URL so client-side fetches work.
//     Adjust NEXT_PUBLIC_SUPABASE_URL if your project URL differs.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";
const connectSrc = ["'self'", supabaseHost].filter(Boolean).join(" ");

const securityHeaders = [
  // Prevent the app from being embedded in iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from sniffing MIME types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send full URL only to same-origin requests; only origin to cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features this app does not use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Content Security Policy.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self'",
      // 'unsafe-inline' needed by Next.js SSR style injection.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]
      .join("; ")
      .trim(),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
