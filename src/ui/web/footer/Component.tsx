import { readFile } from 'fs/promises'
import { join } from 'path'

import { getSystemLocale } from '@/i18n/server-locale'

import { FooterClient } from './FooterClient'
import { loadFooterData } from './footer-data'

/**
 * Read version directly from package.json
 */
async function getVersion(): Promise<string> {
  try {
    const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
    const { version } = JSON.parse(packageJson)
    return version || 'dev'
  } catch {
    return 'dev'
  }
}

export async function Footer() {
  const locale = await getSystemLocale()
  const [data, version] = await Promise.all([loadFooterData(locale), getVersion()])

  return <FooterClient data={data} version={version} />
}
