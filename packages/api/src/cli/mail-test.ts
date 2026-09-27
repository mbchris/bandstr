import { sendAuthEmail } from '../lib/auth-email.js'

type AuthEmailKind = 'verify-email' | 'reset-password' | 'change-email'

type ParsedArgs = {
  command: string | null
  options: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (token === '-h') {
      options.help = true
      continue
    }
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = rest[i + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
      continue
    }
    options[key] = next
    i += 1
  }

  return { command: command ?? null, options }
}

function optionalStringOption(options: Record<string, string | boolean>, key: string): string | null {
  const value = options[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requireStringOption(options: Record<string, string | boolean>, key: string): string {
  const value = optionalStringOption(options, key)
  if (!value) {
    throw new Error(`Missing required option --${key}`)
  }
  return value
}

function parseKind(value: string | null): AuthEmailKind {
  if (!value) return 'verify-email'
  if (value === 'verify-email' || value === 'reset-password' || value === 'change-email') return value
  throw new Error('Invalid --kind. Use one of: verify-email, reset-password, change-email')
}

function getConfiguredTransportName(): string {
  if ((process.env.AUTH_EMAIL_SMTP_HOST ?? process.env.SMTP_SERVER ?? '').trim()) return 'smtp'
  if ((process.env.AUTH_EMAIL_WEBHOOK_URL ?? '').trim()) return 'webhook'
  return 'console-log-fallback'
}

function printHelp(): void {
  console.log(`
bandstr auth mail test CLI:
/app/bandstr-mail-test send --to "user@example.com" [options]

Command:
  send

Options:
  --to <email>            Required recipient
  --kind <kind>           verify-email | reset-password | change-email (default: verify-email)
  --subject <text>        Optional custom subject
  --link <url>            Optional custom link in message body
  --name <text>           Optional display name in greeting (default: there)

Examples:
  /app/bandstr-mail-test send --to "user@example.com"
  /app/bandstr-mail-test send --to "user@example.com" --kind reset-password --link "https://app.example/reset?token=abc"
`)
}

async function send(options: Record<string, string | boolean>): Promise<void> {
  const to = requireStringOption(options, 'to')
  const kind = parseKind(optionalStringOption(options, 'kind'))
  const subject =
    optionalStringOption(options, 'subject') ??
    `bandstr mail test (${kind}) ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`
  const link = optionalStringOption(options, 'link') ?? 'https://example.com/bandstr-mail-test'
  const name = optionalStringOption(options, 'name') ?? 'there'
  const transport = getConfiguredTransportName()

  await sendAuthEmail({
    kind,
    to,
    subject,
    text: [
      `Hi ${name},`,
      '',
      'This is a test email from bandstr auth mail delivery.',
      `Flow kind: ${kind}`,
      `Test link: ${link}`,
      '',
      'If you did not request this test, you can ignore this message.',
    ].join('\n'),
    html: [
      `<p>Hi ${name},</p>`,
      '<p>This is a test email from bandstr auth mail delivery.</p>',
      `<p><strong>Flow kind:</strong> ${kind}</p>`,
      `<p><a href="${link}">Open test link</a></p>`,
      '<p>If you did not request this test, you can ignore this message.</p>',
    ].join(''),
  })

  console.log(`[mail-test] sent via ${transport}: to=${to} kind=${kind}`)
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2))

  if (!command || command === 'help' || command === '--help' || command === '-h' || options.help || options.h) {
    printHelp()
    return
  }

  switch (command) {
    case 'send':
      await send(options)
      break
    default:
      throw new Error(`Unknown command "${command}". Run with "help" for usage.`)
  }
}

main().catch((error: unknown) => {
  console.error('[mail-test] failed', error)
  process.exitCode = 1
})
