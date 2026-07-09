/**
 * @fileType types
 * @domain frontend
 * @pattern footer-data
 * @ai-summary Type-only re-export from the infra loader. The loader itself
 * lives in @/infra/utils/footer-data so the UI server-component can import
 * it directly without crossing the no-UI-to-server-repos boundary.
 */
export {
  loadFooterData,
  resolveMediaUrl,
  type FooterData,
  type FooterLegalPage,
  type FooterNavItem,
  type FooterResolvedLink,
} from '@/infra/utils/footer-data'
