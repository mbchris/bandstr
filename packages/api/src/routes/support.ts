import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

export const support = new Hono<AuthEnv>()

const MAX_SCREENSHOT_DATA_URL_LENGTH = 2_000_000

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
  issuesUrl: string
}

function getBuildId(): string {
  return (process.env.GIT_REV ?? process.env.SOURCE_COMMIT ?? 'dev').trim() || 'dev'
}

function getRuntimeEnv(): string {
  return (process.env.NODE_ENV ?? 'development').trim() || 'development'
}

function getConfiguredIssuesUrl(): string {
  return (process.env.SUPPORT_GITHUB_ISSUES_URL ?? 'https://github.com/prj120/bandstr/issues').trim()
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
    issuesUrl: `https://github.com/${owner}/${repo}/issues`,
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
  screenshotDataUrl?: string
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

  if (args.screenshotDataUrl) {
    lines.push('')
    lines.push('### Screenshot')
    lines.push('')
    lines.push('```text')
    lines.push(args.screenshotDataUrl)
    lines.push('```')
  }

  return lines.join('\n')
}

support.use('*', requireAuth)

support.get('/config', (c) => {
  try {
    const repoConfig = parseRepoConfigFromIssuesUrl(getConfiguredIssuesUrl())
    const hasToken = !!(process.env.SUPPORT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim()
    return c.json({
      issuesUrl: repoConfig.issuesUrl,
      githubEnabled: hasToken,
      buildId: getBuildId(),
      environment: getRuntimeEnv(),
    })
  } catch (error) {
    return c.json({
      issuesUrl: getConfiguredIssuesUrl(),
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

  const issueBody = makeIssueBody({
    kind: body.type,
    message: body.message,
    userName: user.name,
    userId: user.id,
    userEmail: user.email,
    replyEmail: body.email?.trim() || undefined,
    bandId: bandIdHeader || undefined,
    buildId: clientBuildId || getBuildId(),
    environment: clientEnvironment || getRuntimeEnv(),
    screenshotDataUrl: screenshotDataUrl || undefined,
  })

  const response = await fetch(`https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bandstr-support-api',
    },
    body: JSON.stringify({
      title,
      body: issueBody,
      labels: labelSetForKind(body.type),
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    html_url?: string
    number?: number
    message?: string
  }

  if (!response.ok) {
    return c.json({ error: payload.message ?? `GitHub issue creation failed (${response.status})` }, 502)
  }

  return c.json({
    ok: true,
    issueUrl: payload.html_url ?? repoConfig.issuesUrl,
    issueNumber: payload.number ?? null,
  })
})

