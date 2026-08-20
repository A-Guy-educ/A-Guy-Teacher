import type { NextConfig } from 'next'

import { resolveRuntimeOrigin } from './src/config/runtime-origins'

const upstream = resolveRuntimeOrigin({
  development: 'http://app.lvh.me:3000',
  name: 'AGUY_WEB_URL',
  production: 'https://www.aguy.co.il',
  value: process.env.AGUY_WEB_URL || process.env.AGUY_WEB_ORIGIN,
})

if (upstream.hostname === 'teacher.aguy.co.il') {
  throw new Error('AGUY_WEB_URL cannot point back to teacher.aguy.co.il')
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
