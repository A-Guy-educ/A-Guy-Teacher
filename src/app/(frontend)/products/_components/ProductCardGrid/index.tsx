'use client'

import type { Product } from '@/infra/types/content'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { ProductCard } from '../ProductCard'

interface ProductCardGridProps {
  products: Product[]
  /**
   * Forwarded to ProductCard — when true each card renders a disabled
   * "בקרוב" button instead of linking to the detail page (issue #718).
   */
  disabled?: boolean
}

export function ProductCardGrid({ products, disabled = false }: ProductCardGridProps) {
  return (
    <StaggerGrid className="grid gap-content-gap md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} disabled={disabled} />
        </StaggerItem>
      ))}
    </StaggerGrid>
  )
}
