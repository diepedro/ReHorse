/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { instrumentationHook: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://i.ytimg.com https://api.qrserver.com https://is1-ssl.mzstatic.com https://is2-ssl.mzstatic.com https://is3-ssl.mzstatic.com https://is4-ssl.mzstatic.com https://is5-ssl.mzstatic.com",
              "frame-src https://www.youtube.com https://open.spotify.com",
              "connect-src 'self'",
              "media-src 'self' blob: https://p.scdn.co https://audio-ssl.itunes.apple.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
