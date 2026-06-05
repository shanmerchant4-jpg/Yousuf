import type { NextConfig } from "next";

// Static security headers applied to every response.
// NOTE: Content-Security-Policy is intentionally NOT here. The App Router emits
// inline <script> tags (hydration + bootstrap), so the CSP needs a per-request
// nonce — which static headers can't produce. CSP is built in src/proxy.ts
// (middleware) instead.
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
