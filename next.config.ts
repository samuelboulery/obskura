import type { NextConfig } from "next";

/**
 * CSP. `'unsafe-inline'` reste dans `script-src` : le script de préférences du
 * layout et l'amorçage RSC de Next sont inline.
 * ponytail: un nonce par requête (proxy.ts) l'enlèverait, mais rend chaque
 * page dynamique — à faire si une surface d'injection HTML apparaît.
 */
function contentSecurityPolicy(): string {
  // Le HMR de `next dev` évalue du code ; la production n'en a pas besoin.
  const evalSource = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${evalSource} https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
