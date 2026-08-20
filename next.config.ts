import type { NextConfig } from 'next'

const configuredOrigin = process.env.AGUY_WEB_ORIGIN || 'https://www.aguy.co.il'
const upstream = new URL(configuredOrigin)

if (process.env.NODE_ENV === 'production' && upstream.protocol !== 'https:') {
  throw new Error('AGUY_WEB_ORIGIN must use HTTPS in production')
}

if (upstream.hostname === 'teacher.aguy.co.il') {
  throw new Error('AGUY_WEB_ORIGIN cannot point back to teacher.aguy.co.il')
}

const config = {
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/:path*',
          destination: `${upstream.origin}/:path*`,
        },
      ],
    }
  },
} satisfies NextConfig

export default config
