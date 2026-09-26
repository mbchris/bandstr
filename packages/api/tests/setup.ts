import { vi } from 'vitest'

// Set required environment variables for test execution
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://bandstr:bandstr_dev@localhost:5432/bandstr'
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-secret-at-least-32-characters-long-1234567890'
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3001'
process.env.CORS_ORIGINS = 'http://localhost:9000'
process.env.NODE_ENV = 'test'

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
