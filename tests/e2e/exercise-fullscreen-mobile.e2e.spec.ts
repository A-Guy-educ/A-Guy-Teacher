import { expect, test } from '@playwright/test'
import { createHash, randomUUID } from 'crypto'
import { SignJWT } from 'jose'
import { MongoClient, ObjectId } from 'mongodb'

type FullscreenFixture = {
  client: MongoClient
  ids: ObjectId[]
  userIds: ObjectId[]
  url: string
}

let fixture: FullscreenFixture | null = null

test.beforeAll(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
  if (!databaseUrl) return

  const client = await new MongoClient(databaseUrl).connect()
  const db = client.db()
  const now = new Date()
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tenantId = new ObjectId()
  const categoryId = new ObjectId()
  const courseId = new ObjectId()
  const chapterId = new ObjectId()
  const lessonId = new ObjectId()
  const exerciseId = new ObjectId()
  const courseSlug = `fullscreen-course-${suffix}`
  const chapterSlug = `fullscreen-chapter-${suffix}`
  const lessonSlug = `fullscreen-lesson-${suffix}`
  const exerciseSlug = `fullscreen-exercise-${suffix}`

  await db.collection('tenants').insertOne({
    _id: tenantId,
    name: `Fullscreen tenant ${suffix}`,
    slug: `fullscreen-tenant-${suffix}`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('categories').insertOne({
    _id: categoryId,
    title: `Fullscreen category ${suffix}`,
    slug: `fullscreen-category-${suffix}`,
    locale: 'he',
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('courses').insertOne({
    _id: courseId,
    tenant: tenantId,
    categories: [categoryId],
    courseLabel: 'TEST',
    title: 'Fullscreen Test Course',
    slug: courseSlug,
    locale: 'he',
    status: 'published',
    isActive: true,
    accessType: 'free',
    order: 0,
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('chapters').insertOne({
    _id: chapterId,
    tenant: tenantId,
    course: courseId,
    chapterLabel: '1',
    title: 'Fullscreen Test Chapter',
    slug: chapterSlug,
    locale: 'he',
    status: 'published',
    isActive: true,
    order: 0,
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('lessons').insertOne({
    _id: lessonId,
    tenant: tenantId,
    chapter: chapterId,
    title: 'Fullscreen Test Lesson',
    slug: lessonSlug,
    type: 'learning',
    locale: 'he',
    status: 'published',
    isActive: true,
    accessType: 'inherit',
    contentStatus: 'none',
    contentStatusVisible: true,
    order: 0,
    createdAt: now,
    updatedAt: now,
  })
  const exerciseDocument = {
    _id: exerciseId,
    tenant: tenantId,
    lesson: lessonId,
    locale: 'he',
    title: 'Fullscreen Test Exercise',
    slug: exerciseSlug,
    status: 'published',
    order: 0,
    exerciseContent: {
      blocks: [
        {
          id: `prompt-${suffix}`,
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Fullscreen exercise content',
          mediaIds: [],
        },
      ],
    },
    createdAt: now,
    updatedAt: now,
  }
  await db.collection('exercises').insertOne(exerciseDocument)

  fixture = {
    client,
    ids: [exerciseId, lessonId, chapterId, courseId, categoryId, tenantId],
    userIds: [],
    url: `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${exerciseSlug}`,
  }
})

test.afterAll(async () => {
  if (!fixture) return
  const db = fixture.client.db()
  const [exerciseId, lessonId, chapterId, courseId, categoryId, tenantId] = fixture.ids
  await db.collection('users').deleteMany({ _id: { $in: fixture.userIds } })
  await db.collection('exercises').deleteOne({ _id: exerciseId })
  await db.collection('lessons').deleteOne({ _id: lessonId })
  await db.collection('chapters').deleteOne({ _id: chapterId })
  await db.collection('courses').deleteOne({ _id: courseId })
  await db.collection('categories').deleteOne({ _id: categoryId })
  await db.collection('tenants').deleteOne({ _id: tenantId })
  await fixture.client.close()
})

test('mobile exercise fullscreen fills the viewport and hides lesson chrome', async ({
  browser,
}) => {
  test.skip(!fixture, 'No test database available')

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  try {
    const email = `fullscreen-${Date.now()}@example.com`
    const userId = new ObjectId()
    const sessionId = randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await fixture!.client
      .db()
      .collection('users')
      .insertOne({
        _id: userId,
        email,
        name: 'Fullscreen Student',
        role: 'student',
        sessions: [{ id: sessionId, createdAt: new Date(), expiresAt }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    fixture!.userIds.push(userId)
    const secret = process.env.PAYLOAD_SECRET || 'test-secret-key-for-integration-tests-only'
    const key = new TextEncoder().encode(
      createHash('sha256').update(secret).digest('hex').slice(0, 32),
    )
    const token = await new SignJWT({
      id: userId.toHexString(),
      collection: 'users',
      email,
      role: 'student',
      sid: sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(key)
    await context.addCookies([
      {
        name: 'payload-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.goto(fixture!.url)
    await page.waitForURL(/\?section=0&block=0$/)

    const workspace = page.locator('[data-exercise-fullscreen]')
    const expand = page.getByRole('button', { name: 'Expand exercise view' })

    await expect(workspace).toHaveAttribute('data-exercise-fullscreen', 'false')
    await expect(expand).toBeVisible()
    await expand.click()

    await expect(workspace).toHaveAttribute('data-exercise-fullscreen', 'true')
    await expect(workspace.locator('header')).toHaveCount(0)
    await expect(page.locator('.exercise-bottom-nav')).toBeHidden()
    await expect(page.locator('.exercise-header-tabs')).toBeHidden()
    await expect(page.locator('.exercise-top-progress')).toBeHidden()
    await expect(page.locator('.exercise-breadcrumb')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Get help' })).toBeVisible()
    await expect(workspace).toHaveJSProperty('clientWidth', 375)
    await expect(workspace).toHaveJSProperty('clientHeight', 812)

    await page.setViewportSize({ width: 812, height: 375 })
    await expect(workspace).toHaveJSProperty('clientWidth', 812)
    await expect(workspace).toHaveJSProperty('clientHeight', 375)

    await page.getByRole('button', { name: 'Collapse exercise view' }).click()
    await expect(workspace).toHaveAttribute('data-exercise-fullscreen', 'false')
    await expect(workspace.locator('header')).toBeVisible()
  } finally {
    await context.close()
  }
})
