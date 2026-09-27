import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(__dirname, '../../../..')

describe('Admin and Mail CLI help commands', () => {
  it('outputs general command list on "help"', async () => {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['--filter', '@bandstr/api', 'exec', 'tsx', 'src/cli/admin.ts', 'help'],
      { cwd: repoRoot },
    )
    expect(stdout).toContain('bandstr admin CLI')
    expect(stdout).toContain('list-users')
    expect(stdout).toContain('seed-demo-account')
    expect(stdout).toContain('send-band-push')
    expect(stdout).toContain('Show full usage for a command:')
  })

  it('outputs specific command usage on "help <command>"', async () => {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['--filter', '@bandstr/api', 'exec', 'tsx', 'src/cli/admin.ts', 'help', 'seed-demo-account'],
      { cwd: repoRoot },
    )
    expect(stdout).toContain('Command: seed-demo-account')
    expect(stdout).toContain('/app/bandstr-cli seed-demo-account [options]')
    expect(stdout).toContain('--email "<email>"')
    expect(stdout).toContain('--password "<password>"')
  })

  it('outputs specific command usage on "<command> --help"', async () => {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['--filter', '@bandstr/api', 'exec', 'tsx', 'src/cli/admin.ts', 'add-user', '--help'],
      { cwd: repoRoot },
    )
    expect(stdout).toContain('Command: add-user')
    expect(stdout).toContain('/app/bandstr-cli add-user --name "<name>" --email "<email>" [options]')
    expect(stdout).toContain('--email-verified')
    expect(stdout).toContain('--dev-pro-plan')
  })

  it('outputs mail-test usage on "send --help"', async () => {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['--filter', '@bandstr/api', 'exec', 'tsx', 'src/cli/mail-test.ts', 'send', '--help'],
      { cwd: repoRoot },
    )
    expect(stdout).toContain('bandstr auth mail test CLI:')
    expect(stdout).toContain('/app/bandstr-mail-test send --to "user@example.com" [options]')
    expect(stdout).toContain('--kind')
  })
})
