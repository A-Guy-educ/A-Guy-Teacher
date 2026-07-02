import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const doormanPath = resolve(repoRoot, 'doorman/doorman.ts')
const verifyKeyHex = 'a'.repeat(64)

const children: ChildProcessWithoutNullStreams[] = []
const servers: HttpServer[] = []

afterEach(async () => {
  await Promise.all([...children.splice(0).map(stopChild), ...servers.splice(0).map(closeServer)])
})

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate port')))
        return
      }
      const port = address.port
      server.close(() => resolvePort(port))
    })
  })
}

function mintTicket({ r, p }: { r: string; p: number }): string {
  const e = Math.floor(Date.now() / 1000) + 3600
  const s = createHmac('sha256', Buffer.from(verifyKeyHex, 'hex'))
    .update(`${r}#${p}:${e}`)
    .digest('hex')
    .slice(0, 32)

  return Buffer.from(JSON.stringify({ r, p, e, s })).toString('base64url')
}

async function startDoorman(): Promise<{ port: number }> {
  const [port, nextPort] = await Promise.all([getFreePort(), getFreePort()])
  const backend = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.end(`proxied ${req.url}`)
  })
  await new Promise<void>((resolveListen, rejectListen) => {
    backend.once('error', rejectListen)
    backend.listen(nextPort, '127.0.0.1', () => {
      backend.off('error', rejectListen)
      resolveListen()
    })
  })
  servers.push(backend)

  const child = spawn(process.execPath, ['--experimental-strip-types', doormanPath], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      NEXT_INTERNAL_PORT: String(nextPort),
      KODY_PREVIEW_VERIFY_KEY: verifyKeyHex,
      KODY_REPO_CONTEXT: 'owner/repo',
      KODY_PR: '42',
    },
  })
  child.stdin.end()
  children.push(child)

  await new Promise<void>((resolveReady, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => {
      reject(new Error(`doorman did not start: ${stderr}`))
    }, 5000)

    child.stdout.on('data', (chunk: Buffer) => {
      if (chunk.toString('utf8').includes('listening')) {
        clearTimeout(timeout)
        resolveReady()
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`doorman exited early with code ${code}: ${stderr}`))
    })
  })

  return { port }
}

function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolveStop) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveStop()
      return
    }

    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolveStop()
    }, 1000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    child.kill('SIGTERM')
  })
}

function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error)
        return
      }
      resolveClose()
    })
  })
}

describe('preview doorman cookie', () => {
  it('sets a root-scoped session cookie for Next.js static chunks', async () => {
    const { port } = await startDoorman()
    const ticket = mintTicket({ r: 'owner/repo', p: 42 })

    const authRes = await fetch(`http://127.0.0.1:${port}/lesson?kp=${ticket}`, {
      redirect: 'manual',
    })
    const sessionCookie = authRes.headers.get('set-cookie')?.split(';')[0]
    const unauthChunkRes = await fetch(`http://127.0.0.1:${port}/_next/static/chunks/page.js`, {
      redirect: 'manual',
    })
    const authChunkRes = await fetch(`http://127.0.0.1:${port}/_next/static/chunks/page.js`, {
      headers: sessionCookie ? { cookie: sessionCookie } : {},
      redirect: 'manual',
    })

    expect(authRes.status).toBe(302)
    expect(authRes.headers.get('location')).toBe('/lesson')
    expect(authRes.headers.get('set-cookie')).toContain('Path=/')
    expect(unauthChunkRes.status).toBe(401)
    expect(authChunkRes.status).toBe(200)
    await expect(authChunkRes.text()).resolves.toBe('proxied /_next/static/chunks/page.js')
  })
})
