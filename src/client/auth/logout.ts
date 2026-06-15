export async function logoutUser(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Logout failed')
  }
}
