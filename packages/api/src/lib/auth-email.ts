import nodemailer, { type SentMessageInfo, type Transporter } from 'nodemailer'

type AuthEmailKind = 'verify-email' | 'reset-password' | 'change-email'

type AuthEmailPayload = {
  kind: AuthEmailKind
  to: string
  subject: string
  text: string
  html: string
}

function formatLogEmail(payload: AuthEmailPayload): string {
  return [
    '[auth-email]',
    `kind=${payload.kind}`,
    `to=${payload.to}`,
    `subject=${payload.subject}`,
    '',
    payload.text,
  ].join('\n')
}

type SmtpConfig = {
  host: string
  port: number
  startTls: boolean
  user: string
  password: string
  serverName: string
  fromName: string
  fromEmail: string
}

let smtpTransporter: Transporter<SentMessageInfo> | null = null
let smtpTransporterKey = ''

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return fallback
  return parsed
}

function toSmtpConfig(): SmtpConfig | null {
  const host = (process.env.AUTH_EMAIL_SMTP_HOST ?? '').trim()
  if (!host) return null

  const user = (process.env.AUTH_EMAIL_SMTP_USER ?? '').trim()
  const password = (process.env.AUTH_EMAIL_SMTP_PASSWORD ?? '').trim()

  if (!user || !password) {
    throw new Error('Auth email SMTP is configured but AUTH_EMAIL_SMTP_USER or AUTH_EMAIL_SMTP_PASSWORD is missing')
  }

  const fromName = (process.env.AUTH_EMAIL_SMTP_FROM_NAME ?? 'bandstr').trim() || 'bandstr'
  const fromEmail = (process.env.AUTH_EMAIL_SMTP_FROM_EMAIL ?? user).trim()
  const serverName = (process.env.AUTH_EMAIL_SMTP_SERVER_NAME ?? host).trim() || host

  return {
    host,
    port: parsePort(process.env.AUTH_EMAIL_SMTP_PORT, 587),
    startTls: parseBoolean(process.env.AUTH_EMAIL_SMTP_STARTTLS, true),
    user,
    password,
    serverName,
    fromName,
    fromEmail,
  }
}

function toSmtpTransporterKey(config: SmtpConfig): string {
  return [config.host, String(config.port), String(config.startTls), config.user, config.serverName].join('|')
}

function getSmtpTransporter(config: SmtpConfig): Transporter<SentMessageInfo> {
  const key = toSmtpTransporterKey(config)
  if (smtpTransporter && smtpTransporterKey === key) {
    return smtpTransporter
  }

  smtpTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    requireTLS: config.startTls,
    auth: {
      user: config.user,
      pass: config.password,
    },
    name: config.serverName,
    tls: {
      servername: config.serverName,
    },
  })
  smtpTransporterKey = key
  return smtpTransporter
}

async function sendViaSmtp(config: SmtpConfig, payload: AuthEmailPayload): Promise<void> {
  const transporter = getSmtpTransporter(config)
  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Auth email SMTP failed: ${message}`)
  }
}

/**
 * Sends auth emails via SMTP (preferred), optional webhook fallback, then console fallback.
 */
export async function sendAuthEmail(payload: AuthEmailPayload): Promise<void> {
  const smtpConfig = toSmtpConfig()
  if (smtpConfig) {
    await sendViaSmtp(smtpConfig, payload)
    return
  }

  const webhookUrl = (process.env.AUTH_EMAIL_WEBHOOK_URL ?? '').trim()
  const webhookToken = (process.env.AUTH_EMAIL_WEBHOOK_BEARER_TOKEN ?? '').trim()

  if (!webhookUrl) {
    console.info(formatLogEmail(payload))
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (webhookToken) {
    headers.Authorization = `Bearer ${webhookToken}`
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Auth email webhook failed (${response.status}): ${body.slice(0, 300)}`)
  }
}

