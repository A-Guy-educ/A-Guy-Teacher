import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Inline style removal refactor', () => {
  describe('Footer VersionDisplay (FR-001)', () => {
    // The footer was split: Component.tsx loads data, FooterClient.tsx renders.
    // Both files must remain free of inline styles and use design tokens.
    const serverSource = readFileSync(
      join(process.cwd(), 'src/ui/web/footer/Component.tsx'),
      'utf-8',
    )
    const clientSource = readFileSync(
      join(process.cwd(), 'src/ui/web/footer/FooterClient.tsx'),
      'utf-8',
    )
    const combinedSource = `${serverSource}\n${clientSource}`

    it('should NOT contain inline fontSize style', () => {
      expect(combinedSource).not.toMatch(/style=\{\{[\s]*fontSize/)
    })

    it('should still have text-body-xs Tailwind class (design token)', () => {
      expect(combinedSource).toMatch(/text-body-xs/)
    })
  })

  describe('TypingAnimation (FR-002, FR-003)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/web/shared/TypingAnimation/index.tsx'),
      'utf-8',
    )

    it('should NOT contain inline fontFamily style', () => {
      expect(source).not.toMatch(/style=\{\{[\s]*fontFamily/)
    })

    it('should import cn from @/infra/utils/ui', () => {
      expect(source).toMatch(/import\s+\{[^}]*cn[^}]*\}\s+from\s+['"]@\/infra\/utils\/ui['"]/)
    })

    it('should use cn() for class composition with font-mono', () => {
      expect(source).toMatch(/cn\(['"]font-mono['"]/)
    })

    it('should still have font-mono Tailwind class', () => {
      expect(source).toMatch(/font-mono/)
    })

    it('should NOT use template literal for className', () => {
      expect(source).not.toMatch(/className=\{`/)
    })
  })
})
