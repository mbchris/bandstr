import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('semantic icon replacements per issue #36', () => {
  const pagesDir = path.resolve(__dirname, '../src/pages')

  it('replaces icons in SetlistPage.vue with semantic ones', () => {
    const content = fs.readFileSync(path.resolve(pagesDir, 'SetlistPage.vue'), 'utf8')

    // Pinning uses push_pin
    expect(content).toMatch(/push_pin/)
    expect(content).not.toMatch(/:icon="isPinnedItem\(item\)\s*\?\s*'lock'\s*:\s*'lock_open'"/)

    // Drag handle uses drag_handle
    expect(content).toMatch(/drag_handle/)
    expect(content).not.toMatch(/name="drag_indicator"/)

    // Add to setlist uses library_add
    expect(content).toMatch(/library_add/)
  })

  it('replaces icons in VotingPage.vue with semantic ones', () => {
    const content = fs.readFileSync(path.resolve(pagesDir, 'VotingPage.vue'), 'utf8')

    // Pinning uses push_pin
    expect(content).toMatch(/push_pin/)
    expect(content).not.toMatch(/song\.isPinned\s*\?\s*'bookmark'\s*:\s*'bookmark_border'/)

    // Vote action uses thumb_up
    expect(content).toMatch(/thumb_up/)
    expect(content).not.toMatch(/icon="how_to_vote"/)

    // Swipe to accept uses done
    expect(content).toMatch(/done/)

    // Archive / Reactivate uses inventory_2 / replay
    expect(content).toMatch(/inventory_2/)
    expect(content).toMatch(/replay/)

    // Drag handle uses drag_handle
    expect(content).toMatch(/drag_handle/)
    expect(content).not.toMatch(/name="drag_indicator"/)
  })
})
