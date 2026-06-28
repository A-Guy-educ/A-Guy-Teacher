#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const root = process.cwd()
const tasksDir = path.join(root, '.kody', 'tasks')
const memoryDir = path.join(root, '.kody', 'memory')
const indexPath = path.join(memoryDir, 'INDEX.md')
const dryRun = process.env.KODY_DRY_RUN === '1' || process.env.TASK_MEMORY_EXTRACTOR_DRY_RUN === '1'
const noCommit = process.env.KODY_NO_COMMIT === '1' || process.env.TASK_MEMORY_EXTRACTOR_NO_COMMIT === '1'
const validTypes = new Set(['preference', 'decision', 'lesson'])
const reservedNames = new Set(['index', 'readme'])

function log(message) {
  console.error(`[task-memory-extractor] ${message}`)
}

function confidence(raw) {
  if (typeof raw === 'boolean') return 'low'
  if (typeof raw === 'number') {
    if (raw >= 0.7) return 'high'
    if (raw >= 0.4) return 'medium'
    return 'low'
  }
  if (typeof raw === 'string') return raw.trim().toLowerCase()
  return 'low'
}

function slugOk(name) {
  return typeof name === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(name)
}

function validate(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 'record must be object'
  if (!slugOk(rec.name)) return 'invalid name'
  if (reservedNames.has(rec.name)) return 'reserved name'
  if (!validTypes.has(rec.type)) return 'invalid type'
  if (!rec.body && !rec.why && !rec.how_to_apply) return 'missing body/why/how_to_apply'
  return null
}

function frontmatter(rec, taskId, ts) {
  const title = rec.title || rec.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return [
    '---',
    `name: ${rec.name}`,
    `title: ${JSON.stringify(title)}`,
    `type: ${rec.type}`,
    `source: task:${taskId}`,
    `recorded_at: ${ts}`,
    '---',
    '',
  ].join('\n')
}

function body(rec, taskId) {
  const parts = []
  if (rec.body) parts.push(String(rec.body).trimEnd())
  if (rec.why) parts.push(`\n**Why:** ${rec.why}`)
  if (rec.how_to_apply) parts.push(`**How apply:** ${rec.how_to_apply}`)
  parts.push(`\n**Source task:** \`${taskId}\``)
  return `${parts.join('\n').trim()}\n`
}

function updateIndex(rec, filename) {
  const hook = rec.hook || (rec.title || '').split('\n', 1)[0] || String(rec.why || '').slice(0, 120) || '(no hook)'
  const title = rec.title || rec.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const line = `- [${title}](${filename}) - ${hook} (type: ${rec.type})`
  const marker = `](${filename})`
  const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8').split(/\r?\n/) : []
  let replaced = false
  const out = existing.filter((_, i) => !(i === existing.length - 1 && existing[i] === '')).map(raw => {
    if (raw.includes(marker)) {
      replaced = true
      return line
    }
    return raw
  })
  if (!replaced) {
    if (out.length && out[out.length - 1].trim()) out.push('')
    out.push(line)
  }
  fs.writeFileSync(indexPath, `${out.join('\n').replace(/\s+$/u, '')}\n`)
}

function writeMemory(rec, taskId, ts) {
  const target = path.join(memoryDir, `${rec.name}.md`)
  fs.writeFileSync(target, frontmatter(rec, taskId, ts) + body(rec, taskId))
  updateIndex(rec, `${rec.name}.md`)
}

function git(args, check = false) {
  const result = cp.spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  if (check && result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result
}

function commitAndPush(summary) {
  git(['add', '.kody/memory', '.kody/tasks'])
  const status = git(['status', '--porcelain', '--', '.kody/memory', '.kody/tasks']).stdout.trim()
  if (!status) return false
  const commit = git(['commit', '-m', summary])
  if (commit.status !== 0) {
    log(`git commit failed: ${commit.stderr.trim()}`)
    return false
  }
  const push = git(['push', 'origin', 'HEAD'])
  if (push.status !== 0) {
    log(`git push failed: ${push.stderr.trim()}`)
    return false
  }
  return true
}

fs.mkdirSync(memoryDir, { recursive: true })
if (!fs.existsSync(tasksDir)) {
  log('no .kody/tasks/ - nothing to extract')
  process.exit(0)
}

let tasksSeen = 0
let skippedDone = 0
let written = 0
let skippedLow = 0
let skippedMedium = 0
let skippedDup = 0
let skippedInvalid = 0
const writtenRecs = []
const now = new Date().toISOString()

for (const taskName of fs.readdirSync(tasksDir).sort()) {
  const taskDir = path.join(tasksDir, taskName)
  if (!fs.statSync(taskDir).isDirectory()) continue
  const recsPath = path.join(taskDir, 'memory-recs.json')
  if (!fs.existsSync(recsPath)) continue
  tasksSeen += 1
  const marker = path.join(taskDir, '.extracted')
  if (fs.existsSync(marker)) {
    skippedDone += 1
    continue
  }

  let recs
  try {
    recs = JSON.parse(fs.readFileSync(recsPath, 'utf8') || '[]')
  } catch (error) {
    log(`task ${taskName}: invalid JSON (${error.message})`)
    if (!dryRun) fs.closeSync(fs.openSync(marker, 'w'))
    continue
  }
  if (!Array.isArray(recs)) {
    log(`task ${taskName}: memory-recs.json must be a JSON array`)
    if (!dryRun) fs.closeSync(fs.openSync(marker, 'w'))
    continue
  }

  for (const rec of recs) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      skippedInvalid += 1
      continue
    }
    const err = validate(rec)
    if (err) {
      log(`task ${taskName}: skip rec (${err})`)
      skippedInvalid += 1
      continue
    }
    const conf = confidence(rec.confidence)
    if (conf === 'low') {
      skippedLow += 1
      continue
    }
    if (conf === 'medium') {
      skippedMedium += 1
      continue
    }
    if (fs.existsSync(path.join(memoryDir, `${rec.name}.md`))) {
      skippedDup += 1
      continue
    }
    if (dryRun) {
      log(`task ${taskName}: would write .kody/memory/${rec.name}.md`)
    } else {
      writeMemory(rec, taskName, now)
      log(`task ${taskName}: wrote .kody/memory/${rec.name}.md`)
    }
    written += 1
    writtenRecs.push([taskName, rec.name])
  }
  if (!dryRun) fs.closeSync(fs.openSync(marker, 'w'))
}

log(`tick complete: tasks_seen=${tasksSeen} skipped_done=${skippedDone} written=${written} skipped_medium=${skippedMedium} skipped_low=${skippedLow} dup-skipped=${skippedDup} invalid-skipped=${skippedInvalid}`)

if (!writtenRecs.length) process.exit(0)
if (dryRun) {
  log('dry run complete (skipped memory writes, markers, commit)')
  process.exit(0)
}
if (noCommit) {
  log('commit suppressed by env')
  process.exit(0)
}

const summary = [`chore(memory): file ${writtenRecs.length} task lesson(s)`, '', ...writtenRecs.map(([taskId, name]) => `- ${name} (from task ${taskId})`)].join('\n')
if (commitAndPush(summary)) {
  log(`committed + pushed ${writtenRecs.length} new memory file(s)`)
} else {
  log('no commit made (nothing changed or git error logged above)')
}
NODE
