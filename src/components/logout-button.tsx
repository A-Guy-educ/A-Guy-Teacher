'use client'

import { useState } from 'react'

export function LogoutButton({ labels }: { labels: { idle: string; pending: string } }) {
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = (await response.json()) as { redirectTo: string }
      window.location.assign(result.redirectTo)
    } catch {
      setPending(false)
    }
  }

  return (
    <button
      className="teacher-button teacher-button--quiet"
      disabled={pending}
      onClick={logout}
      type="button"
    >
      {pending ? labels.pending : labels.idle}
    </button>
  )
}
