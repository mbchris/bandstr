import { vi, beforeAll } from 'vitest'

beforeAll(async () => {
  const { runMigrations } = await import('../src/db/migrate.js')
  await runMigrations()
})

// Mock Nodemailer to prevent external email dispatch
vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        verify: vi.fn().mockResolvedValue(true),
      }),
    },
  }
})
