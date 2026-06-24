import * as React from 'react'
import { cn } from '@/infra/utils/ui'

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether to apply responsive width classes.
   * - Mobile: 100% width
   * - Tablet (md): 92% width
   * - Desktop (lg+): max-width 896px
   * @default true
   */
  responsive?: boolean

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Child elements
   */
  children: React.ReactNode
}

/**
 * Layout container that expands to use available screen width.
 *
 * @example
 * ```tsx
 * <Container>Content</Container>
 * <Container responsive={false} className="max-w-4xl">Fixed width</Container>
 * ```
 */
export function Container({ responsive = true, className, children, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        responsive && 'w-full md:w-11/12 lg:max-w-[896px]',
        !responsive && 'w-full max-w-[896px]',
        'mx-auto',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

Container.displayName = 'Container'
