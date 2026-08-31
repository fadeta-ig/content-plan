/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8050',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8050',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'creative.wijayainovasi.co.id',
        pathname: '/media/**',
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'",
      },
    ];
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8050'}/api/v1/:path*`,
      },
      {
        source: '/accounts/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8050'}/accounts/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8050'}/static/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8050'}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
