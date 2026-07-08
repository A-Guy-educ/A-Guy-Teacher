import type { Header, Footer, Page } from '@/infra/types/content'

type NavItemLink = {
  type?: ('reference' | 'custom') | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages'
    value: string | Page
  } | null
  url?: string | null
  label: string
}

export type NavItem = {
  link: NavItemLink
  id?: string | null
}

/**
 * Returns true when the given nav-items list is non-empty AND at least one
 * item has a non-empty label. Used to decide whether a per-locale variant is
 * actually usable.
 */
function hasUsableLabels(items: NavItem[] | null | undefined): boolean {
  if (!items || items.length === 0) return false
  return items.some((item) => {
    const label = item?.link?.label
    return typeof label === 'string' && label.trim().length > 0
  })
}

/**
 * Select nav items from the variant matching the given system locale.
 * Falls back to the first variant, then to the root-level navItems, then to
 * an empty list. When the per-locale variant is empty or has no labelled
 * items, we prefer the root list so that links never render blank.
 *
 * Handles both old format (direct navItems field) and new format (variants array)
 * for backwards compatibility with existing database entries.
 */
export function getNavItemsForLocale(data: Header | Footer | undefined, locale: string): NavItem[] {
  // Handle new format with variants array
  const variants = data?.variants
  if (variants && variants.length > 0) {
    const matched = variants.find((v) => v.locale === locale) || variants[0]
    if (matched && hasUsableLabels(matched.navItems as NavItem[] | null | undefined)) {
      return matched.navItems as NavItem[]
    }
  }

  // Handle old format (backwards compatibility) - direct navItems field
  // This was the format before the content-locale feature was added
  return (data as unknown as { navItems?: NavItem[] })?.navItems || []
}
