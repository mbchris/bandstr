import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('AuthLayout scrolling and mobile responsiveness', () => {
  const layoutPath = path.resolve(__dirname, '../src/layouts/AuthLayout.vue')
  const content = fs.readFileSync(layoutPath, 'utf-8')

  it('does not have overflow: hidden on the page container', () => {
    // overflow: hidden on .auth-start-page blocks vertical scrolling on Android and iOS
    expect(content).not.toMatch(/\.auth-start-page\s*\{[^}]*overflow:\s*hidden/s)
  })

  it('keeps video background fixed or non-blocking to allow content scrolling', () => {
    // The video should be fixed or out of document flow with pointer-events: none
    expect(content).toMatch(/\.auth-video-bg\s*\{[^}]*position:\s*fixed/s)
  })

  it('allows the card to center gracefully without flex cutoff on small screens', () => {
    // Using margin: auto on the card ensures it centers when space allows but starts at top when overflowing
    expect(content).toMatch(/\.auth-card\s*\{[^}]*margin:\s*auto/s)
  })

  it('supports safe area insets for mobile devices', () => {
    expect(content).toContain('safe-area-inset')
  })
})
