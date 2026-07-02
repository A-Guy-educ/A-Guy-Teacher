import { describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../../src/middleware'

/**
 * Auth Middleware Integration Tests
 *
 * Tests that the middleware correctly restricts learning features to authenticated users
 * while allowing public access to landing pages.
 */

const createRequest = (path: string, host = 'example.com', cookies?: string) => {
  const url = new URL(path, `http://${host}`)
  const headers = new Headers()
  headers.set('host', host)
  if (cookies) {
    headers.set('cookie', cookies)
  }
  return new NextRequest(url, { headers })
}

describe('Auth Middleware - Learning Feature Protection', () => {
  describe('Protected routes - should redirect to /login when not authenticated', () => {
    const protectedRoutes = [
      '/study',
      '/practice',
      '/test',
      '/ask',
      '/courses/advanced-math',
      '/courses/math/chapters/intro/lessons/first-lesson',
    ]

    it.each(protectedRoutes)('should redirect unauthenticated request to %s to /login', (route) => {
      const request = createRequest(route)
      const response = middleware(request)

      expect(response.status).toBe(307) // Temporary redirect
      const location = response.headers.get('location')
      expect(location).toContain('/login')
      expect(location).toContain(`returnTo=${encodeURIComponent(route)}`)
    })

    it('should include returnTo query param when redirecting protected route', () => {
      const route = '/study'
      const request = createRequest(route)
      const response = middleware(request)

      const location = response.headers.get('location')
      expect(location).toContain(`/login?returnTo=${encodeURIComponent(route)}`)
    })
  })

  describe('Public routes - should pass through without redirect', () => {
    const publicRoutes = ['/']

    it.each(publicRoutes)('should allow unauthenticated request to %s', (route) => {
      const request = createRequest(route)
      const response = middleware(request)

      // Should pass through (status 200 for NextResponse.next())
      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })
  })

  describe('Authenticated requests - should pass through all routes', () => {
    const allRoutes = [
      '/',
      '/courses',
      '/courses/advanced-math',
      '/study',
      '/practice',
      '/test',
      '/ask',
      '/courses/math/chapters/intro/lessons/first-lesson',
    ]

    it.each(allRoutes)('should allow authenticated request to %s', (route) => {
      // Create request with a payload token cookie (simulating authenticated user)
      const request = createRequest(
        route,
        'example.com',
        'payload-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      )
      const response = middleware(request)

      // Should pass through without redirect
      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should redirect anonymous /courses with query params to /start', () => {
      const request = createRequest('/courses?sort=popular')
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://example.com/start')
    })

    it('should handle course slug routes correctly', () => {
      const courseRoute = '/courses/advanced-math'
      const request = createRequest(courseRoute)
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
      expect(response.headers.get('location')).toContain(
        `returnTo=${encodeURIComponent(courseRoute)}`,
      )
    })

    it('should redirect anonymous nested course routes to login', () => {
      const route = '/courses/math/chapters/intro/lessons/first-lesson/content/page-1'
      const request = createRequest(route)
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
      expect(response.headers.get('location')).toContain(`returnTo=${encodeURIComponent(route)}`)
    })
  })
})
