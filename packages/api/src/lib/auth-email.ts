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

/**
 * Sends auth emails via optional webhook, with a safe console fallback for local/dev setups.
 */
export async function sendAuthEmail(payload: AuthEmailPayload): Promise<void> {
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

