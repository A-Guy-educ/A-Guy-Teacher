export interface HomeRedirectInput {
  isAuthenticated: boolean
  selectedCourseId?: string | null
}

export function resolveHomeRedirect({
  isAuthenticated,
  selectedCourseId,
}: HomeRedirectInput): '/login' | '/start' | '/study' {
  if (!isAuthenticated) return '/login'

  if (!selectedCourseId?.trim()) return '/start'

  return '/study'
}
