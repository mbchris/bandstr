import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Setlist Active/Archive Tabs & Swipe Logic (#28 Task 4)', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('has i18n keys for tabs and swipe actions in English and German', () => {
    expect(en.setlist).toHaveProperty('activeTab')
    expect(de.setlist).toHaveProperty('activeTab')
    expect(en.setlist.activeTab).toBe('Active')
    expect(de.setlist.activeTab).toBe('Aktiv')

    expect(en.setlist).toHaveProperty('archiveTab')
    expect(de.setlist).toHaveProperty('archiveTab')
    expect(en.setlist.archiveTab).toBe('Archive')
    expect(de.setlist.archiveTab).toBe('Archiv')

    expect(en.setlist).toHaveProperty('songMovedToVotingNamed')
    expect(de.setlist).toHaveProperty('songMovedToVotingNamed')
    expect(en.setlist.songMovedToVotingNamed).toContain('{title}')
    expect(de.setlist.songMovedToVotingNamed).toContain('{title}')

    expect(en.setlist).toHaveProperty('songArchivedNamed')
    expect(de.setlist).toHaveProperty('songArchivedNamed')
    expect(en.setlist.songArchivedNamed).toContain('{title}')
    expect(de.setlist.songArchivedNamed).toContain('{title}')

    expect(en.setlist).toHaveProperty('songReactivatedNamed')
    expect(de.setlist).toHaveProperty('songReactivatedNamed')
    expect(en.setlist.songReactivatedNamed).toContain('{title}')
    expect(de.setlist.songReactivatedNamed).toContain('{title}')
  })

  it('renders q-tabs with Active and Archive tabs and count badges in Master Setlist mode', () => {
    expect(content).toContain('<q-tabs')
    expect(content).toMatch(/v-if="!selectedGigId && selectedSetlistMode === 'master'"/)
    expect(content).toMatch(/v-model="currentTab"/)
    expect(content).toContain('<q-tab name="active"')
    expect(content).toContain('<q-tab name="archived"')
    expect(content).toContain(":label=\"t('setlist.activeTab')\"")
    expect(content).toContain(":label=\"t('setlist.archiveTab')\"")
    expect(content).toContain('activeSetlistSongsCount')
    expect(content).toContain('archivedSetlistSongsCount')
  })

  it('filters activeSongs based on currentTab', () => {
    expect(content).toMatch(/currentTab\.value === 'archived'/)
    expect(content).toMatch(/s\.isSetlist && s\.type === 'song' && s\.isArchived/)
    expect(content).toMatch(/s\.isSetlist && \(s\.type !== 'song' \|\| !s\.isArchived\)/)
  })

  it('wraps list items in q-slide-item with swipe event handlers and slots', () => {
    expect(content).toContain('<q-slide-item')
    expect(content).toContain('@left=')
    expect(content).toContain('@right=')
    expect(content).toContain('onSwipeRight')
    expect(content).toContain('onSwipeLeft')

    // Icons for swipe operations
    expect(content).toContain('how_to_vote')
    expect(content).toContain('unarchive')
    expect(content).toContain('archive')
  })

  it('removes redundant arrow_back (Move to Voting) action button from song actions', () => {
    const songActionsMatch = content.match(/<!-- Actions -->[\s\S]*?<q-item-section side>([\s\S]*?)<\/q-item-section>/)
    expect(songActionsMatch).not.toBeNull()
    const songActionsContent = songActionsMatch![1]

    expect(songActionsContent).not.toContain('arrow_back')
    expect(songActionsContent).not.toContain('moveToVoting')
  })

  it('guards togglePin lock button on master setlist archived tab', () => {
    expect(content).toMatch(/v-if="selectedGigId \|\| selectedSetlistMode !== 'master' \|\| currentTab === 'active'"[\s\S]*?@click="togglePin\(item\)"/)
  })

  it('calls updateSong without as any type assertions in swipe and pin functions', () => {
    // onSwipeRight, onSwipeLeft, and togglePin should not use 'as any' on updateSong
    const swipeSection = content.slice(content.indexOf('async function togglePin'), content.indexOf('async function removeFromSetlist'))
    expect(swipeSection).not.toContain('as any')
  })

  it('notifies with undo actions and timeout on swipe operations', () => {
    expect(content).toContain("t('common.undo')")
    expect(content).toContain('songMovedToVotingNamed')
    expect(content).toContain('songArchivedNamed')
    expect(content).toContain('songReactivatedNamed')
    expect(content).toContain('timeout: 6000')
  })
})
