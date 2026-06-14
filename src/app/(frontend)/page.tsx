import { DemoLandingPage } from '@/ui/web/homepage/DemoLandingPage'
import { resolveLandingRedirect } from '@/infra/onboarding/homeRedirect'
import { getMeUser } from '@/infra/utils/getMeUser'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export default async function HomepagePage() {
  const { user } = await getMeUser()
  const destination = resolveLandingRedirect(Boolean(user))

  if (destination) {
    redirect(destination)
  }

  return <DemoLandingPage />
}

export function generateMetadata(): Metadata {
  return {
    title: 'Aguy - הדור הבא של הלמידה',
    description:
      'פלטפורמת למידה אישית למתמטיקה עם שיעורים, תרגול, מורה דיגיטלי, תוכנית אישית וזמינות מלאה.',
    openGraph: {
      title: 'Aguy - הדור הבא של הלמידה',
      description: 'ממש כמו מורה פרטי, רק זמין יותר, משתלם יותר ומותאם בדיוק בשבילך.',
      images: [{ url: '/website-template-OG.webp' }],
    },
  }
}
