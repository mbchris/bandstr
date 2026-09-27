import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { optionalAuth, type OptionalAuthEnv } from '../middleware/auth.js'
import { resolveBuildIdFromEnvironment } from '../lib/build-id.js'

export const support = new Hono<OptionalAuthEnv>()

const MAX_SCREENSHOT_DATA_URL_LENGTH = 2_000_000
const DEFAULT_SUPPORT_ASSIGNEE = 'mbchris'

const createTicketSchema = z.object({
  type: z.enum(['bug', 'feature', 'comment']),
  message: z.string().trim().min(10).max(10_000),
  email: z.string().email().optional().or(z.literal('')),
  screenshotDataUrl: z.string().optional(),
})

type SupportKind = z.infer<typeof createTicketSchema>['type']

type RepoConfig = {
  owner: string
  repo: string
}

function getBuildId(): string {
  return resolveBuildIdFromEnvironment() || 'dev'
}

function getRuntimeEnv(): string {
  return (process.env.NODE_ENV ?? 'development').trim() || 'development'
}

function getConfiguredIssuesUrl(): string {
  return (process.env.SUPPORT_GITHUB_ISSUES_URL ?? 'https://github.com/prj120/bandstr/issues').trim()
}

function getSupportAssignees(): string[] {
  const configured = (process.env.SUPPORT_GITHUB_ASSIGNEES ?? DEFAULT_SUPPORT_ASSIGNEE)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return configured.length ? configured : [DEFAULT_SUPPORT_ASSIGNEE]
}

function parseRepoConfigFromIssuesUrl(url: string): RepoConfig {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid SUPPORT_GITHUB_ISSUES_URL')
  }

  const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')
  if (parts.length < 2) {
    throw new Error('SUPPORT_GITHUB_ISSUES_URL must contain owner/repo')
  }

  const owner = parts[0]
  const repo = parts[1]

  return {
    owner,
    repo,
  }
}

function labelSetForKind(kind: SupportKind): string[] {
  if (kind === 'bug') return ['support', 'type:bug']
  if (kind === 'feature') return ['support', 'type:feature']
  return ['support', 'type:comment']
}

function titlePrefix(kind: SupportKind): string {
  if (kind === 'bug') return '[Support][Bug]'
  if (kind === 'feature') return '[Support][Feature]'
  return '[Support][Comment]'
}

function sanitizeForTitle(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function sanitizeForPath(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'user'
}

function screenshotExtensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  throw new Error('Unsupported screenshot format. Please use PNG, JPG, GIF, or WEBP.')
}

function parseScreenshotDataUrl(input: string): { bytes: Buffer; mimeType: string; extension: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(input)
  if (!match) {
    throw new Error('Invalid screenshot payload')
  }
  const mimeType = match[1].toLowerCase()
  const extension = screenshotExtensionForMimeType(mimeType)
  const base64 = match[2].replace(/\s+/g, '')
  const bytes = Buffer.from(base64, 'base64')
  if (!bytes.length) {
    throw new Error('Screenshot is empty')
  }
  return { bytes, mimeType, extension }
}

async function uploadScreenshotToRepo(args: {
  owner: string
  repo: string
  token: string
  screenshotDataUrl: string
  userId: string
}): Promise<string> {
  const parsed = parseScreenshotDataUrl(args.screenshotDataUrl)
  const datePart = new Date().toISOString().slice(0, 10)
  const screenshotPath = `support-screenshots/${datePart}/${sanitizeForPath(args.userId)}/${Date.now()}-${randomUUID()}.${parsed.extension}`

  const response = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}/contents/${screenshotPath}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bandstr-support-api',
    },
    body: JSON.stringify({
      message: `chore(support): upload screenshot ${datePart}`,
      content: parsed.bytes.toString('base64'),
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    content?: {
      download_url?: string | null
      html_url?: string | null
    }
    message?: string
  }

  if (!response.ok) {
    throw new Error(payload.message ?? `GitHub screenshot upload failed (${response.status})`)
  }

  const downloadUrl = payload.content?.download_url?.trim() ?? ''
  if (downloadUrl) return downloadUrl
  const htmlUrl = payload.content?.html_url?.trim() ?? ''
  if (htmlUrl) return `${htmlUrl}?raw=1`
  throw new Error('GitHub screenshot upload succeeded but did not return a usable URL')
}

function makeIssueBody(args: {
  kind: SupportKind
  message: string
  userName: string
  userId: string
  userEmail: string
  replyEmail?: string
  bandId?: string
  buildId: string
  environment: string
  screenshotUrl?: string
}): string {
  const lines: string[] = []
  lines.push(`## Support ${args.kind}`)
  lines.push('')
  lines.push(args.message)
  lines.push('')
  lines.push('---')
  lines.push('### Metadata')
  lines.push(`- user: ${args.userName} (${args.userId})`)
  lines.push(`- account email: ${args.userEmail}`)
  lines.push(`- reply email: ${args.replyEmail || '-'}`)
  lines.push(`- band id: ${args.bandId || '-'}`)
  lines.push(`- build id: ${args.buildId}`)
  lines.push(`- environment: ${args.environment}`)

  if (args.screenshotUrl) {
    lines.push('')
    lines.push('### Screenshot')
    lines.push('')
    lines.push(`![Support screenshot](${args.screenshotUrl})`)
    lines.push('')
    lines.push(`[Open screenshot](${args.screenshotUrl})`)
  }

  return lines.join('\n')
}

type GitHubApiError = {
  resource?: string
  field?: string
  code?: string
  message?: string
}

function parseGitHubErrorMessage(payload: { message?: string; errors?: GitHubApiError[] }, status: number): string {
  const base = payload.message?.trim() || `GitHub request failed (${status})`
  const details = (payload.errors ?? [])
    .map((entry) => [entry.resource, entry.field, entry.code, entry.message].filter(Boolean).join(': '))
    .filter(Boolean)
  if (!details.length) return base
  return `${base} (${details.join('; ')})`
}

function hasAssigneeValidationError(payload: { errors?: GitHubApiError[] }): boolean {
  return (payload.errors ?? []).some((entry) => {
    const field = (entry.field ?? '').toLowerCase()
    return field === 'assignees' || field === 'assignee'
  })
}

support.use('*', optionalAuth)

support.get('/config', (c) => {
  try {
    parseRepoConfigFromIssuesUrl(getConfiguredIssuesUrl())
    const hasToken = !!(process.env.SUPPORT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim()
    return c.json({
      githubEnabled: hasToken,
      buildId: getBuildId(),
      environment: getRuntimeEnv(),
    })
  } catch (error) {
    return c.json({
      githubEnabled: false,
      buildId: getBuildId(),
      environment: getRuntimeEnv(),
      warning: error instanceof Error ? error.message : 'Support config error',
    })
  }
})

support.post('/tickets', zValidator('json', createTicketSchema), async (c) => {
  const body = c.req.valid('json')
  const screenshotDataUrl = body.screenshotDataUrl?.trim() || ''
  if (screenshotDataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
    return c.json({ error: 'Screenshot exceeds max supported size' }, 400)
  }

  const token = (process.env.SUPPORT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim()
  if (!token) {
    return c.json({ error: 'Support GitHub integration is not configured' }, 503)
  }

  let repoConfig: RepoConfig
  try {
    repoConfig = parseRepoConfigFromIssuesUrl(getConfiguredIssuesUrl())
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Support configuration error' }, 500)
  }

  const user = c.get('user')
  const titleFirstLine = sanitizeForTitle(body.message.split('\n')[0] ?? '')
  const title = `${titlePrefix(body.type)} ${titleFirstLine.slice(0, 100) || 'New ticket'}`

  const bandIdHeader = c.req.header('X-Band-Id')?.trim() ?? ''
  const clientBuildId = c.req.header('X-Client-Build-Id')?.trim() ?? ''
  const clientEnvironment = c.req.header('X-Client-Environment')?.trim() ?? ''

  let screenshotUrl: string | undefined
  if (screenshotDataUrl) {
    try {
      screenshotUrl = await uploadScreenshotToRepo({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        token,
        screenshotDataUrl,
        userId: user ? user.id : 'anonymous',
      })
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to upload screenshot',
        },
        502,
      )
    }
  }

  const issueBody = makeIssueBody({
    kind: body.type,
    message: body.message,
    userName: user?.name ?? (body.email?.trim() || 'Anonymous'),
    userId: user?.id ?? 'anonymous',
    userEmail: user?.email ?? (body.email?.trim() || 'none'),
    replyEmail: body.email?.trim() || undefined,
    bandId: bandIdHeader || undefined,
    buildId: clientBuildId || getBuildId(),
    environment: clientEnvironment || getRuntimeEnv(),
    screenshotUrl,
  })

  const requestHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bandstr-support-api',
  }

  const createIssue = async (assignees?: string[]) => {
    const response = await fetch(`https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/issues`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        title,
        body: issueBody,
        labels: labelSetForKind(body.type),
        assignees,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      html_url?: string
      number?: number
      message?: string
      errors?: GitHubApiError[]
    }
    return { response, payload }
  }

  let { response, payload } = await createIssue(getSupportAssignees())

  if (!response.ok && response.status === 422 && hasAssigneeValidationError(payload)) {
    const retried = await createIssue(undefined)
    response = retried.response
    payload = retried.payload
  }

  if (!response.ok) {
    return c.json({ error: parseGitHubErrorMessage(payload, response.status) }, 502)
  }

  return c.json({
    ok: true,
    issueNumber: payload.number ?? null,
  })
})
