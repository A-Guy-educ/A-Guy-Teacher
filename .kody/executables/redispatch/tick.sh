#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const fs = require('fs')
const cp = require('child_process')

const dryRun = true
const liveTestLabel = 'kody:test-redispatch'
const excludeLabels = new Set(['kody:stuck', 'kody:no-redispatch', 'kody:stalled'])
const stateFile = '.kody/duties/redispatch.state.json'
const dryRunLogCap = 50
const fortyMinSecs = 40 * 60
const now = new Date()
const nowIso = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
const utcDay = nowIso.slice(0, 10)

function run(args, opts = {}) {
  const result = cp.spawnSync(args[0], args.slice(1), { encoding: 'utf8', ...opts })
  if (result.status !== 0 && opts.check !== false) {
    const err = new Error(result.stderr || result.stdout || `${args.join(' ')} failed`)
    err.result = result
    throw err
  }
  return result.stdout
}

function ghJson(args) {
  const out = run(['gh', ...args], { check: true })
  return out.trim() ? JSON.parse(out) : null
}

function loadPriorState() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    return [(raw.data && raw.data.perIssue) || {}, (raw.data && raw.data.dryRunLog) || []]
  } catch {
    return [{}, []]
  }
}

const stateBlockRe = /<!--\s*kody:state:v1:begin\s*-->([\s\S]*?)<!--\s*kody:state:v1:end\s*-->/m
const fenceRe = /```(?:json)?\s*([\s\S]*?)```/m

function extractStateJson(body) {
  const match = stateBlockRe.exec(body || '')
  if (!match) return null
  const inner = match[1]
  const fence = fenceRe.exec(inner)
  const raw = fence ? fence[1] : inner
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function latestHistoryTs(state) {
  const history = (state.core && state.core.history) || state.history || []
  const timestamps = history.map(h => h && h.timestamp).filter(x => typeof x === 'string')
  if (timestamps.length) return timestamps.sort().at(-1)
  const last = state.core && state.core.lastOutcome && state.core.lastOutcome.timestamp
  return typeof last === 'string' ? last : null
}

function ageSeconds(ts) {
  const parsed = Date.parse(ts)
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((now.getTime() - parsed) / 1000))
}

function findLatestStateBlock(ownerRepo, issueNum, body) {
  const candidates = []
  const fromBody = extractStateJson(body)
  if (fromBody) candidates.push(['0000-01-01T00:00:00Z', fromBody])
  const comments = ghJson(['api', `repos/${ownerRepo}/issues/${issueNum}/comments?per_page=100`]) || []
  for (const comment of comments) {
    const state = extractStateJson(comment.body || '')
    if (state) candidates.push([comment.created_at || '', state])
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  return candidates[0][1]
}

function hasFreshKodyComment(ownerRepo, issueNum) {
  const comments = ghJson(['api', `repos/${ownerRepo}/issues/${issueNum}/comments?per_page=100`]) || []
  for (const comment of comments.slice(-30)) {
    const body = comment.body || ''
    if (!/^(@kody|✅ kody|⚙️ kody)/m.test(body)) continue
    if (ageSeconds(comment.created_at || '') < fortyMinSecs) return true
  }
  return false
}

function hasOpenKodyPr(state) {
  const prUrl = state.prUrl || (state.core && state.core.prUrl) || ''
  const match = /\/pull\/(\d+)/.exec(prUrl)
  if (!match) return [false, prUrl]
  try {
    const ownerRepo = run(['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
    const pr = ghJson(['api', `repos/${ownerRepo}/pulls/${match[1]}`])
    return [pr && pr.state === 'open', prUrl]
  } catch {
    return [false, prUrl]
  }
}

function hasInFlightWorkflow(ownerRepo, issueNum) {
  const runs = ghJson(['api', `repos/${ownerRepo}/actions/runs?status=in_progress&per_page=30`])
  if (!runs || !Array.isArray(runs.workflow_runs)) return false
  const needle = `#${issueNum}`
  const branchNeedle = `${issueNum}--`
  return runs.workflow_runs.some(r => {
    const title = `${r.display_title || ''} ${r.name || ''}`
    const head = r.head_branch || ''
    return title.includes(needle) || head.includes(branchNeedle) || head.includes(`-${issueNum}-`)
  })
}

const ownerRepo = run(['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
const [priorPerIssue, priorDryLog] = loadPriorState()
const newPerIssue = {}
for (const [key, value] of Object.entries(priorPerIssue)) {
  if (!value || typeof value !== 'object') continue
  const next = { ...value }
  if (String(next.lastResumedAt || '').slice(0, 10) !== utcDay) next.attemptsToday = 0
  newPerIssue[key] = next
}

const issues = ghJson(['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,labels,updatedAt,body']) || []
const rows = []
const actions = []

for (const issue of issues) {
  const n = issue.number
  const labels = new Set((issue.labels || []).map(l => l.name || ''))
  let skipReason = null
  let state = null
  let historyTs = null

  for (const label of labels) {
    if (excludeLabels.has(label)) skipReason = `excluded by label: ${label}`
  }

  if (!skipReason) {
    state = findLatestStateBlock(ownerRepo, n, issue.body || '')
    if (!state) skipReason = 'no kody state block'
    else {
      const core = state.core || {}
      if (core.status !== 'running') skipReason = `core.status=${JSON.stringify(core.status)} (not 'running')`
      else {
        historyTs = latestHistoryTs(state)
        if (!historyTs) skipReason = 'no history timestamp in state'
        else if (ageSeconds(historyTs) < fortyMinSecs) skipReason = `history fresh (${Math.floor(ageSeconds(historyTs) / 60)}min < 40min threshold)`
      }
    }
  }
  if (!skipReason) {
    const [ok, prUrl] = hasOpenKodyPr(state || {})
    if (ok) skipReason = `open kody PR still active (${prUrl})`
  }
  if (!skipReason && hasInFlightWorkflow(ownerRepo, n)) skipReason = 'in-flight workflow run'
  if (!skipReason && hasFreshKodyComment(ownerRepo, n)) skipReason = 'fresh kody comment (<40min)'

  if (skipReason) {
    rows.push({ issue: n, action: 'skip', reason: skipReason, history_ts: historyTs })
    continue
  }

  const prior = newPerIssue[String(n)] || {}
  const attemptsToday = Number(prior.attemptsToday || 0)
  const lastResumedHistory = prior.lastResumedHistoryTimestamp || ''
  let action = 'resume'
  let reason = `core.status=running, history age >40min (${historyTs}), no blockers`

  if (attemptsToday >= 1) {
    if (lastResumedHistory && historyTs && historyTs > lastResumedHistory) {
      rows.push({ issue: n, action: 'skip', reason: `already resumed today; state advanced (${lastResumedHistory} -> ${historyTs}) - letting run`, history_ts: historyTs })
      continue
    }
    action = 'mark-stuck'
    reason = 'already resumed once today and state did not advance'
  }

  if (!dryRun && !labels.has(liveTestLabel)) {
    rows.push({ issue: n, action: 'skip', reason: `live-test gate: missing label ${JSON.stringify(liveTestLabel)}`, history_ts: historyTs })
    continue
  }

  rows.push({ issue: n, action, reason, history_ts: historyTs })
  actions.push({ issue: n, action, reason, history_ts: historyTs })
}

let dryLog = priorDryLog.slice()
for (const action of actions) {
  const n = action.issue
  if (dryRun) {
    dryLog.push({ issueNumber: n, action: action.action, reason: action.reason, plannedAt: nowIso })
  } else {
    try {
      if (action.action === 'resume') run(['gh', 'issue', 'comment', String(n), '--body', '@kody resume'])
      if (action.action === 'mark-stuck') {
        run(['gh', 'issue', 'comment', String(n), '--body', 'kody resume did not advance state - needs human'])
        run(['gh', 'issue', 'edit', String(n), '--add-label', 'kody:stuck'])
      }
    } catch (error) {
      rows.push({ issue: n, action: 'error', reason: `comment/label failed: ${error.message}`, history_ts: action.history_ts })
      continue
    }
  }
  const prior = newPerIssue[String(n)] || {}
  if (action.action === 'resume') {
    newPerIssue[String(n)] = {
      lastResumedAt: nowIso,
      lastResumedHistoryTimestamp: action.history_ts || '',
      attemptsToday: Number(prior.attemptsToday || 0) + 1,
      stuck: false,
    }
  } else if (action.action === 'mark-stuck') {
    newPerIssue[String(n)] = { ...prior, stuck: true }
  }
}
dryLog = dryLog.slice(-dryRunLogCap)

console.log(`[redispatch] now=${nowIso} dry_run=${dryRun} candidates=${issues.length}`)
console.log('')
console.log('| issue | action | history_ts | reason |')
console.log('|---|---|---|---|')
for (const row of rows) {
  console.log(`| #${row.issue} | ${row.action} | ${row.history_ts || '-'} | ${String(row.reason).replace(/\|/g, '/')} |`)
}
console.log(`actions taken this tick: ${actions.length}`)
console.log('```kody-job-next-state')
console.log(JSON.stringify({
  cursor: `redispatch-${nowIso}`,
  data: { perIssue: newPerIssue, dryRunLog: dryLog },
  done: false,
}, null, 2))
console.log('```')
NODE
