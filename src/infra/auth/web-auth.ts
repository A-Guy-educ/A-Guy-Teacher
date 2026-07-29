/**
 * Web Authentication — password login, Google OAuth, and session management
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Password + Google OAuth auth entry point — `linkGoogleUser` attaches Google credentials to an existing email/password account without touching the password, so users retain email login after linking. Session tokens are JWTs signed with a derived key; short-lived (7 days) with server-side session records for revocation.
 */

import { createHash, pbkdf2, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

import { SignJWT, jwtVerify } from 'jose'
import type { Document, ObjectId } from 'mongodb'

import { getContentDb, objectIdFromString, relationId, serializeDoc } from '@/infra/db/content-db'
import type { User } from '@/infra/types/content'
import { encrypt, generateSecret } from './oauth_crypto'
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  type AuthCookieOptions,
} from './shared-login/auth-cookie'
import { authCookieOptionsFor } from './shared-login/auth-cookie.env'
import type { ReadableHeaders } from './shared-login/embedded-request'

export { AUTH_COOKIE_NAME }
export {
  appendAuthCookieClearHeaders,
  authCookieDeleteOptions,
} from './shared-login/auth-cookie.env'

const pbkdf2Async = promisify(pbkdf2)
const TOKEN_MAX_AGE = AUTH_COOKIE_MAX_AGE_SECONDS
const HASH_ITERATIONS = 25000
const HASH_LENGTH = 512

type UserDoc = Document & {
  _id?: ObjectId
  email?: string
  hash?: string
  salt?: string
  name?: string
  role?: string
  sessions?: unknown[]
  googleSub?: string
  oauthLoginSecretEnc?: string
}

type AuthUser = User & { collection: 'users' }

async function users() {
  return (await getContentDb()).collection<UserDoc>('users')
}

function secretKey() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required')
  return new TextEncoder().encode(createHash('sha256').update(secret).digest('hex').slice(0, 32))
}

function userId(user: UserDoc) {
  return relationId(user._id) ?? relationId(user.id) ?? ''
}

function cleanUser(user: UserDoc): AuthUser {
  const safe = serializeDoc<Record<string, unknown>>(user)
  delete safe.hash
  delete safe.salt
  delete safe.sessions
  delete safe.oauthLoginSecretEnc
  delete safe.googleSub
  return {
    ...safe,
    id: userId(user),
    role: typeof safe.role === 'string' ? safe.role : 'student',
    collection: 'users',
  } as AuthUser
}

async function hashPassword(password: string, salt = randomBytes(32).toString('hex')) {
  const hash = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_LENGTH, 'sha256')
  return { salt, hash: Buffer.from(hash).toString('hex') }
}

async function passwordMatches(password: string, salt: string, hash: string) {
  const stored = Buffer.from(hash, 'hex')
  if (stored.length !== HASH_LENGTH) return false
  const candidate = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_LENGTH, 'sha256')
  return timingSafeEqual(Buffer.from(candidate), stored)
}

export async function findUserByEmail(email: string) {
  return (await users()).findOne(
    { email: email.trim().toLowerCase() },
    { collation: { locale: 'en', strength: 2 } },
  )
}

export async function findUserByGoogleSub(googleSub: string) {
  return (await users()).findOne({ googleSub })
}

export async function createSession(user: UserDoc) {
  const sid = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_MAX_AGE * 1000)
  const collection = await users()

  await collection.updateOne({ _id: user._id }, {
    $pull: { sessions: { expiresAt: { $lte: now } } },
  } as Document)

  await collection.updateOne({ _id: user._id }, {
    $push: { sessions: { id: sid, createdAt: now, expiresAt } },
    $set: { updatedAt: now },
  } as Document)

  const token = await new SignJWT({
    id: userId(user),
    collection: 'users',
    email: user.email,
    role: user.role ?? 'student',
    sid,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE)
    .sign(secretKey())

  return { token, user: cleanUser(user) }
}

export async function getSessionFromToken(token?: string | null) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.collection !== 'users' || typeof payload.id !== 'string') return null
    if (typeof payload.sid !== 'string') return null
    const user = await (
      await users()
    ).findOne({
      _id: objectIdFromString(payload.id),
      sessions: {
        $elemMatch: {
          id: payload.sid,
          expiresAt: { $gt: new Date() },
        },
      },
    } as Document)
    return user ? { token, user: cleanUser(user) } : null
  } catch {
    return null
  }
}

export function tokenFromHeaders(headers: Headers) {
  const auth = headers.get('authorization')?.match(/^(?:Bearer|JWT)\s+(.+)$/i)?.[1]
  if (auth) return auth
  return headers
    .get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1)
}

export async function loginWithPassword(email: string, password: string) {
  const user = await findUserByEmail(email)
  if (!user?.salt || !user.hash) return null
  return (await passwordMatches(password, user.salt, user.hash)) ? createSession(user) : null
}

export async function createPasswordUser(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase()
  const existing = await findUserByEmail(email)
  if (existing) return null

  const password = await hashPassword(input.password)
  const now = new Date()
  const collection = await users()
  let insertedId: ObjectId
  try {
    const result = await collection.insertOne({
      email,
      name: input.name.trim(),
      role: 'student',
      registrationMethod: 'email',
      registeredAt: now,
      hash: password.hash,
      salt: password.salt,
      sessions: [],
      createdAt: now,
      updatedAt: now,
    })
    insertedId = result.insertedId
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return null
    }
    throw error
  }

  const user = await collection.findOne({ _id: insertedId })
  if (!user) throw new Error('Created user was not found')
  return createSession(user)
}

export async function linkGoogleUser(
  user: UserDoc,
  google: { sub: string; email: string; name?: string; picture?: string },
) {
  await (
    await users()
  ).updateOne(
    { _id: user._id },
    {
      $set: {
        googleSub: google.sub,
        verifiedEmail: google.email,
        googleProfile: { name: google.name, picture: google.picture },
        updatedAt: new Date(),
      },
    },
  )
}

export async function createGoogleUser(google: {
  sub: string
  email: string
  name?: string
  picture?: string
}) {
  const secret = generateSecret()
  const password = await hashPassword(secret)
  const now = new Date()
  const result = await (
    await users()
  ).insertOne({
    email: google.email.trim().toLowerCase(),
    name: google.name || google.email.split('@')[0],
    role: 'student',
    googleSub: google.sub,
    verifiedEmail: google.email.trim().toLowerCase(),
    googleProfile: { name: google.name, picture: google.picture },
    registrationMethod: 'google',
    registeredAt: now,
    oauthLoginSecretEnc: encrypt(secret),
    hash: password.hash,
    salt: password.salt,
    sessions: [],
    createdAt: now,
    updatedAt: now,
  })
  return (await users()).findOne({ _id: result.insertedId })
}

export function setAuthCookie(
  res: {
    cookies: {
      set: (name: string, value: string, options: AuthCookieOptions) => void
    }
  },
  token: string,
  /**
   * Incoming request headers, when the caller has them. They decide whether
   * the cookie is written in its shareable or its partitioned form — see
   * `isEmbeddedRequest`. Omitting them yields the shareable form.
   */
  requestHeaders?: ReadableHeaders,
) {
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptionsFor(requestHeaders))
}

/**
 * Remove a session from the user document so the token stops authenticating.
 *
 * Clearing the cookie only logs out the browser that asked; revoking the
 * session id is what makes logout effective for every app that shares this
 * database, and what invalidates a token that was copied elsewhere.
 */
export async function revokeSession(token?: string | null): Promise<void> {
  if (!token) return

  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.id !== 'string' || typeof payload.sid !== 'string') return

    await (
      await users()
    ).updateOne(
      { _id: objectIdFromString(payload.id) } as Document,
      {
        $pull: { sessions: { id: payload.sid } },
        $set: { updatedAt: new Date() },
      } as Document,
    )
  } catch {
    // Invalid, expired, or forged token — there is nothing to revoke.
  }
}
