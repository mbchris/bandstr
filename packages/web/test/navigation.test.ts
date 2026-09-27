import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Account Deletion UI Discoverability (Apple Guideline 4)', () => {
  it('has nav.deleteAccount translation keys in en and de', () => {
    expect(en.nav.deleteAccount).toBe('Account Security & Deletion')
    expect(de.nav.deleteAccount).toBe('Konto löschen')
  })

  it('verifies MainLayout.vue includes account deletion in the user account menu', () => {
    const layoutPath = path.resolve(__dirname, '../src/layouts/MainLayout.vue')
    const content = fs.readFileSync(layoutPath, 'utf-8')

    // Must navigate to /delete-account
    expect(content).toContain("router.push('/delete-account')")

    // Must use nav.deleteAccount translation key
    expect(content).toContain("t('nav.deleteAccount')")

    // Must have delete_forever icon
    expect(content).toContain('delete_forever')

    // Must appear in the account menu before Sign Out
    const deleteAccountIndex = content.indexOf("router.push('/delete-account')")
    const signOutIndex = content.indexOf("t('nav.signOut')")
    expect(deleteAccountIndex).toBeGreaterThan(0)
    expect(signOutIndex).toBeGreaterThan(0)
    expect(deleteAccountIndex).toBeLessThan(signOutIndex)
  })

  it('verifies DashboardPage.vue includes direct navigation to /delete-account in user profile section', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/DashboardPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Must contain /delete-account navigation
    expect(content).toContain("router.push('/delete-account')")

    // Must contain a link in the user profile area (near loggedInAs / userIdentity)
    const loggedInAsIndex = content.indexOf("t('dashboard.loggedInAs'")
    expect(loggedInAsIndex).toBeGreaterThan(0)

    // Slice around user profile section
    const profileSection = content.slice(loggedInAsIndex, loggedInAsIndex + 500)
    expect(profileSection).toContain("router.push('/delete-account')")
    expect(profileSection).toContain("t('nav.deleteAccount')")
  })
})

describe('Navigation Bar & Icon Redesign (Issue #29)', () => {
  it('verifies MainLayout uses Lucide icons for tabs instead of raster webp icons', () => {
    const layoutPath = path.resolve(__dirname, '../src/layouts/MainLayout.vue')
    const content = fs.readFileSync(layoutPath, 'utf-8')

    // Must import Lucide icons
    expect(content).toContain("from 'lucide-vue-next'")
    expect(content).toContain('Home')
    expect(content).toContain('ThumbsUp')
    expect(content).toContain('ListMusic')
    expect(content).toContain('Calendar')
    expect(content).toContain('Settings')

    // Must not import old raster tab webp icons
    expect(content).not.toContain("home_bl.webp")
    expect(content).not.toContain("voting_bl.webp")
    expect(content).not.toContain("setlist_bl.webp")
    expect(content).not.toContain("calendar_bl.webp")
    expect(content).not.toContain("admin_bl.webp")

    // Must use .bandstr-bottom-nav and modern .nav-item
    expect(content).toContain('class="bandstr-bottom-nav"')
    expect(content).toContain('class="nav-item"')
    expect(content).toContain('class="tab-icon"')
  })
})

