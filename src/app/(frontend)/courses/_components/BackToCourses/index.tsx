'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'

interface BackToCoursesProps {
  href?: string
}

export function BackToCourses({ href = '/courses' }: BackToCoursesProps) {
  const t = useTranslations('courses')
  return (
    <nav className="mb-6">
      <Button variant="link" asChild className="pl-0">
        <SystemLink href={href}>← {t('backToCourses')}</SystemLink>
      </Button>
    </nav>
  )
}
