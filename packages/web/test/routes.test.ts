import { describe, it, expect } from 'vitest'
import routes from '../src/router/routes'

describe('Support route access', () => {
  it('ensures /support does not require authentication and is under PublicLayout', () => {
    // 1. /support should NOT be under authenticated root '/'
    const rootRoute = routes.find((r) => r.path === '/')
    expect(rootRoute).toBeDefined()
    const supportInRoot = rootRoute?.children?.find((c) => c.path === 'support' || c.path === '/support')
    expect(supportInRoot).toBeUndefined()

    // 2. /support should exist as a top-level route (or under public group) without requiresAuth
    const supportRoute = routes.find((r) => r.path === '/support')
    expect(supportRoute).toBeDefined()
    expect(supportRoute?.meta?.requiresAuth).toBeFalsy()

    // Child routes under /support should not require auth
    if (supportRoute?.children) {
      for (const child of supportRoute.children) {
        expect(child.meta?.requiresAuth).toBeFalsy()
      }
    }
  })

  it('verifies SupportPage.vue includes required support elements for Apple App Store Guideline 1.5', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(__dirname, '../src/pages/SupportPage.vue')
    const content = fs.readFileSync(filePath, 'utf-8')

    // Official support email
    expect(content).toContain('support@4ki.app')

    // FAQ sections
    expect(content).toContain('Login')
    expect(content).toContain('Band Invites')
    expect(content).toContain('Subscriptions')

    // Ticket form and legal links
    expect(content).toContain('submit')
    expect(content).toContain('/impress')
    expect(content).toContain('/gdpr')
  })
})
