/** @type {import('next').NextConfig} */

// Build gates
// -----------
// STRICT_BUILD=1  `next build` fails on TypeScript errors (CI sets this).
// unset           type errors never block a production deploy; Supabase/runtime errors are handled inside the app.
// Turn it on in Vercel once `npm run verify` is green, so deploys are gated by the same check as CI.
// Linting is its own gate (`npm run lint`), so `next build` does not run ESLint.
const strictBuild = process.env.STRICT_BUILD === '1';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: !strictBuild },
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Production only, so embedded dev previews (iframes) keep working.
    if (process.env.NODE_ENV !== 'production') return [];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
