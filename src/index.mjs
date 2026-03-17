#!/usr/bin/env node

/**
 * claude-minibar — Minimal 2-line statusline for Claude Code
 *
 * Line 1: [Model | Effort] Context N% | X files +N -N
 * Line 2: Usage ██░░░░░░░░ N% (Xh Xm / 5h) | ██░░░░░░░░ N% (Xd / 7d)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, userInfo } from 'node:os'
import * as https from 'node:https'

// ── Paths ──
const HOME = homedir()
const PLUGIN_CACHE_DIR = join(HOME, '.claude', 'plugins', 'claude-minibar')
const USAGE_CACHE_PATH = join(PLUGIN_CACHE_DIR, '.usage-cache.json')
const DIFF_CACHE_PATH = join(PLUGIN_CACHE_DIR, '.diff-cache.json')
const SETTINGS_PATH = join(HOME, '.claude', 'settings.json')
const CACHE_TTL_MS = 5 * 60_000
const RATE_LIMIT_TTL_MS = 60_000
const KEYCHAIN_SERVICE = 'Claude Code-credentials'

function ensureCacheDir() {
  if (!existsSync(PLUGIN_CACHE_DIR)) mkdirSync(PLUGIN_CACHE_DIR, { recursive: true })
}

// ── ANSI Colors ──
const cyan = (s) => `\x1b[36m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const RESET = '\x1b[0m'

// ── Read stdin ──
async function readStdin() {
  if (process.stdin.isTTY) return null
  const chunks = []
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = chunks.join('')
  return raw.trim() ? JSON.parse(raw) : null
}

// ── Context color ──
function contextColor(percent) {
  return percent >= 85 ? '\x1b[31m' : percent >= 60 ? '\x1b[33m' : '\x1b[32m'
}

// ── Usage bar ──
function quotaBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  const color = percent >= 80 ? '\x1b[31m' : percent >= 50 ? '\x1b[33m' : '\x1b[36m'
  return `${color}${'█'.repeat(filled)}${dim('░'.repeat(empty))}${RESET}`
}

function quotaColor(percent) {
  return percent >= 80 ? '\x1b[31m' : percent >= 50 ? '\x1b[33m' : '\x1b[36m'
}

// ── Effort level ──
function getEffortLevel() {
  try {
    if (!existsSync(SETTINGS_PATH)) return null
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    const level = settings.effortLevel
    if (!level) return null
    const map = { low: 'Low', medium: 'Med', high: 'High' }
    return map[level] || level
  } catch { return null }
}

// ── Session duration ──
function formatDuration(ms) {
  if (ms < 0) return null
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
}

function getSessionDuration(transcriptPath) {
  if (!transcriptPath) return null
  // 文件尚未创建（新会话首次渲染），直接返回 <1m
  if (!existsSync(transcriptPath)) return '<1m'
  try {
    const fileSize = statSync(transcriptPath).size
    if (fileSize > 0) {
      const fd = openSync(transcriptPath, 'r')
      const buf = Buffer.alloc(Math.min(4096, fileSize))
      readSync(fd, buf, 0, buf.length, 0)
      closeSync(fd)
      for (const line of buf.toString('utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          if (entry.timestamp) return formatDuration(Date.now() - new Date(entry.timestamp).getTime())
        } catch {}
      }
    }
    // fallback: use file creation time as session start
    const birthtime = statSync(transcriptPath).birthtimeMs
    if (birthtime > 0) return formatDuration(Date.now() - birthtime)
  } catch {}
  return null
}

// ── File changes (incremental transcript parsing) ──
function countLines(str) {
  if (!str) return 0
  return str.split('\n').filter(l => l.length > 0).length
}

function getFileChanges(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null

  let cache = { offset: 0, files: {}, added: 0, removed: 0, transcriptPath: '' }
  try {
    if (existsSync(DIFF_CACHE_PATH)) {
      const saved = JSON.parse(readFileSync(DIFF_CACHE_PATH, 'utf8'))
      if (saved.transcriptPath === transcriptPath) cache = saved
    }
  } catch {}

  const fileSize = statSync(transcriptPath).size
  if (fileSize <= cache.offset) {
    const fileCount = Object.keys(cache.files).length
    return fileCount === 0 ? null : { files: fileCount, added: cache.added, removed: cache.removed }
  }

  const fd = openSync(transcriptPath, 'r')
  const buf = Buffer.alloc(fileSize - cache.offset)
  readSync(fd, buf, 0, buf.length, cache.offset)
  closeSync(fd)

  const newContent = buf.toString('utf8')
  const lastNewline = newContent.lastIndexOf('\n')
  if (lastNewline === -1) {
    const fileCount = Object.keys(cache.files).length
    return fileCount === 0 ? null : { files: fileCount, added: cache.added, removed: cache.removed }
  }

  const completeContent = newContent.slice(0, lastNewline + 1)
  const newOffset = cache.offset + Buffer.byteLength(completeContent, 'utf8')

  const toolMap = new Map()
  const failedIds = new Set()

  for (const line of completeContent.split('\n')) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      if (entry.type === 'assistant') {
        const contents = entry.message?.content
        if (!Array.isArray(contents)) continue
        for (const c of contents) {
          if (c.type === 'tool_use' && (c.name === 'Edit' || c.name === 'Write')) {
            toolMap.set(c.id, { name: c.name, input: c.input })
          }
        }
      } else if (entry.type === 'user') {
        const contents = entry.message?.content
        if (!Array.isArray(contents)) continue
        for (const c of contents) {
          if (c.type === 'tool_result' && c.is_error) failedIds.add(c.tool_use_id)
        }
      }
    } catch {}
  }

  for (const [id, tool] of toolMap) {
    if (failedIds.has(id)) continue
    const input = tool.input
    if (!input?.file_path) continue
    cache.files[input.file_path] = true
    if (tool.name === 'Edit') {
      cache.removed += countLines(input.old_string)
      cache.added += countLines(input.new_string)
    } else if (tool.name === 'Write') {
      cache.added += countLines(input.content)
    }
  }

  cache.offset = newOffset
  cache.transcriptPath = transcriptPath
  try {
    ensureCacheDir()
    writeFileSync(DIFF_CACHE_PATH, JSON.stringify(cache), 'utf8')
  } catch {}

  const fileCount = Object.keys(cache.files).length
  return fileCount === 0 ? null : { files: fileCount, added: cache.added, removed: cache.removed }
}

// ── Usage API ──
function readUsageCache() {
  try {
    if (!existsSync(USAGE_CACHE_PATH)) return null
    const cache = JSON.parse(readFileSync(USAGE_CACHE_PATH, 'utf8'))
    const age = Date.now() - cache.timestamp
    if (!cache.data?.apiUnavailable && age < CACHE_TTL_MS) return cache.data
    if (cache.data?.apiUnavailable && age < RATE_LIMIT_TTL_MS && cache.lastGoodData) return cache.lastGoodData
    if (cache.lastGoodData) return { ...cache.lastGoodData, _stale: true }
    return null
  } catch { return null }
}

function writeUsageCache(data, lastGoodData) {
  try {
    ensureCacheDir()
    const cache = { data, timestamp: Date.now() }
    if (lastGoodData) cache.lastGoodData = lastGoodData
    writeFileSync(USAGE_CACHE_PATH, JSON.stringify(cache), 'utf8')
  } catch {}
}

function getLastGoodData() {
  try {
    if (!existsSync(USAGE_CACHE_PATH)) return null
    const cache = JSON.parse(readFileSync(USAGE_CACHE_PATH, 'utf8'))
    return cache.lastGoodData || (cache.data?.apiUnavailable ? null : cache.data)
  } catch { return null }
}

/**
 * 解析凭据数据（文件和 Keychain 共用）
 */
function parseCredentials(data) {
  const token = data.claudeAiOauth?.accessToken
  const sub = data.claudeAiOauth?.subscriptionType ?? ''
  if (!token) return null
  const expiresAt = data.claudeAiOauth?.expiresAt
  if (expiresAt != null && expiresAt <= Date.now()) return null
  return { token, subscriptionType: sub }
}

/**
 * 从 ~/.claude/.credentials.json 读取凭据（CLI 登录写入）
 */
function readFileToken() {
  try {
    const credPath = join(HOME, '.claude', '.credentials.json')
    if (!existsSync(credPath)) return null
    const data = JSON.parse(readFileSync(credPath, 'utf8'))
    return parseCredentials(data)
  } catch { return null }
}

/**
 * 从 macOS Keychain 读取凭据（Claude Code Desktop 写入）
 */
function readKeychainToken() {
  if (process.platform !== 'darwin') return null
  const tryRead = (args) => {
    const raw = execFileSync('/usr/bin/security', args, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000
    }).trim()
    if (!raw) return null
    return parseCredentials(JSON.parse(raw))
  }
  try {
    const username = userInfo().username.trim()
    if (username) {
      const result = tryRead(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', username, '-w'])
      if (result) return result
    }
  } catch {}
  try {
    return tryRead(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'])
  } catch { return null }
}

function getPlanName(sub) {
  const lower = (sub || '').toLowerCase()
  if (lower.includes('max')) return 'Max'
  if (lower.includes('pro')) return 'Pro'
  if (lower.includes('team')) return 'Team'
  if (!sub || lower.includes('api')) return null
  return sub.charAt(0).toUpperCase() + sub.slice(1)
}

/**
 * 调用 Anthropic Usage API
 * 返回 { data, status } 以便区分 429 和其他错误
 */
function fetchUsageApi(accessToken) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-minibar/1.0',
      },
      timeout: 10_000,
    }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c.toString() })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ data: null, status: res.statusCode })
          return
        }
        try { resolve({ data: JSON.parse(data), status: 200 }) }
        catch { resolve({ data: null, status: 0 }) }
      })
    })
    req.on('error', () => resolve({ data: null, status: 0 }))
    req.on('timeout', () => { req.destroy(); resolve({ data: null, status: 0 }) })
    req.end()
  })
}

function formatResetTime(resetAt) {
  if (!resetAt) return ''
  const diffMs = new Date(resetAt).getTime() - Date.now()
  if (diffMs <= 0) return ''
  const mins = Math.ceil(diffMs / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remH = hours % 24
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`
  }
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
}

function clamp(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(Math.max(0, Math.min(100, v)))
}

/**
 * 获取 usage 数据，两级凭据回退：
 * 1. 文件凭据（~/.claude/.credentials.json，CLI 登录写入）→ 调 API
 * 2. 若 429 → Keychain 凭据（Claude Code Desktop 写入）→ 调 API
 * 3. 都失败 → 用缓存兜底，等下次重试
 */
async function getUsageData() {
  const cached = readUsageCache()
  if (cached && !cached._stale) return cached

  // 收集可用凭据：文件优先，Keychain 兜底
  const credSources = []
  const fileCreds = readFileToken()
  if (fileCreds) credSources.push(fileCreds)
  const keychainCreds = readKeychainToken()
  // 避免重复（同一个 token）
  if (keychainCreds && keychainCreds.token !== fileCreds?.token) {
    credSources.push(keychainCreds)
  }

  if (credSources.length === 0) return cached || null

  // 依次尝试每个凭据源
  for (const creds of credSources) {
    const planName = getPlanName(creds.subscriptionType)
    if (!planName) continue

    const { data: apiData, status } = await fetchUsageApi(creds.token)

    if (apiData) {
      // API 成功
      const result = {
        planName,
        fiveHour: clamp(apiData.five_hour?.utilization),
        sevenDay: clamp(apiData.seven_day?.utilization),
        fiveHourResetAt: apiData.five_hour?.resets_at || null,
        sevenDayResetAt: apiData.seven_day?.resets_at || null,
      }
      writeUsageCache(result, result)
      return result
    }

    // 非 429 错误（网络问题等），不再尝试下一个凭据
    if (status !== 429) break
    // 429 → 继续尝试下一个凭据源
  }

  // 所有凭据都失败
  const lastGood = getLastGoodData()
  const planName = getPlanName(credSources[0].subscriptionType) || 'Unknown'
  const fail = { planName, fiveHour: null, sevenDay: null, apiUnavailable: true }
  writeUsageCache(fail, lastGood)
  return lastGood || cached || null
}

// ── Main ──
async function main() {
  const stdin = await readStdin()
  if (!stdin) { console.log('[minibar] Initializing...'); return }

  // Line 1: Model + Effort + Context + File changes
  const modelName = stdin.model?.display_name?.trim() || stdin.model?.id || 'Unknown'
  const percent = (() => {
    const native = stdin.context_window?.used_percentage
    if (typeof native === 'number' && !Number.isNaN(native)) {
      return Math.min(100, Math.max(0, Math.round(native)))
    }
    const size = stdin.context_window?.context_window_size
    if (!size || size <= 0) return 0
    const usage = stdin.context_window?.current_usage
    const total = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0)
    return Math.min(100, Math.round((total / size) * 100))
  })()

  const usage = await getUsageData()
  const effort = getEffortLevel()
  const effortDisplay = effort ? ` | ${effort}` : ''

  const duration = getSessionDuration(stdin.transcript_path)
  const durationDisplay = duration ? ` ${dim(`⏱️  ${duration}`)}` : ''

  let line1 = `${cyan(`[${modelName}${effortDisplay}]`)} ${dim('Context')} ${contextColor(percent)}${percent}%${RESET}${durationDisplay}`

  const changes = getFileChanges(stdin.transcript_path)
  if (changes) {
    const parts = [`${changes.files} file${changes.files > 1 ? 's' : ''}`]
    if (changes.added > 0) parts.push(green(`+${changes.added}`))
    if (changes.removed > 0) parts.push(red(`-${changes.removed}`))
    line1 += ` ${dim('|')} ${dim(parts[0])} ${parts.slice(1).join(' ')}`
  }

  console.log(line1)

  // Line 2: Usage
  if (usage && usage.fiveHour != null) {
    const fiveHourReset = formatResetTime(usage.fiveHourResetAt)
    const fiveHourPart = fiveHourReset
      ? `${quotaBar(usage.fiveHour)} ${quotaColor(usage.fiveHour)}${usage.fiveHour}%${RESET} (${fiveHourReset} / 5h)`
      : `${quotaBar(usage.fiveHour)} ${quotaColor(usage.fiveHour)}${usage.fiveHour}%${RESET}`

    let line2 = `${dim('Usage')} ${fiveHourPart}`

    if (usage.sevenDay != null && usage.sevenDay >= 10) {
      const sevenDayReset = formatResetTime(usage.sevenDayResetAt)
      const sevenDayPart = sevenDayReset
        ? `${quotaBar(usage.sevenDay)} ${quotaColor(usage.sevenDay)}${usage.sevenDay}%${RESET} (${sevenDayReset} / 7d)`
        : `${quotaBar(usage.sevenDay)} ${quotaColor(usage.sevenDay)}${usage.sevenDay}%${RESET}`
      line2 += ` ${dim('|')} ${sevenDayPart}`
    }

    console.log(line2)
  }
}

main().catch(() => {})
