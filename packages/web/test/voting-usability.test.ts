import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Voting Page Usability Overhaul (#28 Task 3)', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/VotingPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('has i18n keys for clearVote and selfVoteHint in English and German', () => {
    expect(en.voting).toHaveProperty('clearVote')
    expect(de.voting).toHaveProperty('clearVote')
    expect(en.voting.clearVote).toBe('Remove vote')
    expect(de.voting.clearVote).toBe('Stimme entfernen')

    expect(en.voting.selfVoteHint).toBe('Vote')
    expect(de.voting.selfVoteHint).toBe('Abstimmen')
  })

  it('uses 0-9 scale in voteBorderColor calculation', () => {
    // Should scale clamped score over 9 and multiply by 120 hue
    expect(content).toMatch(/Math\.min\(9,\s*score\)/)
    expect(content).toMatch(/\(clampedScore\s*\/\s*9\)\s*\*\s*120/)
  })

  it('configures 0-9 slider popup with immediate commit on release (@change)', () => {
    expect(content).toContain('<q-slider')
    expect(content).toMatch(/v-model="currentVoteScore"/)
    expect(content).toMatch(/:min="0"/)
    expect(content).toMatch(/:max="9"/)
    expect(content).toMatch(/:step="1"/)
    expect(content).toContain('snap')
    expect(content).toContain('label')
    expect(content).toMatch(/@change="onVoteSliderCommit"/)
    expect(content).toContain('class="vote-slider"')
  })

  it('styles vote-slider track with red-to-green gradient', () => {
    expect(content).toContain('.vote-slider')
    expect(content).toMatch(/linear-gradient\(90deg,\s*#ef4444.*#22c55e\)/)
  })

  it('places voting button immediately right of avatar stack and opens details dialog on avatar stack click', () => {
    expect(content).toMatch(/class="avatar-stack\s+cursor-pointer/)
    expect(content).toMatch(/@click="openDetailsDialog\(song\)"/)
    expect(content).toMatch(/<q-btn\s+dense\s+flat\s+(:icon="pIcon\('thumb_up'\)"|icon="how_to_vote")\s+@click="openVotePicker\(song\)"/)
    // Eye icon (visibility) button should be removed
    expect(content).not.toMatch(/icon="visibility"/)
  })

  it('removes redundant Archive and Send to Setlist buttons from song actions', () => {
    const songActionsMatch = content.match(/<div class="column q-gutter-xs song-actions">([\s\S]*?)<\/div>/)
    expect(songActionsMatch).not.toBeNull()
    const songActionsContent = songActionsMatch![1]

    expect(songActionsContent).not.toContain('arrow_forward')
    expect(songActionsContent).not.toContain('openTransferModal')
    expect(songActionsContent).not.toContain('archiveSong')
    expect(songActionsContent).not.toContain('reactivateSong')
    expect(songActionsContent).toContain('openEditModal')
    expect(songActionsContent).toContain('deleteSong')
  })

  it('places Status Filter and Sort By side-by-side on mobile with col-6 col-sm-3', () => {
    expect(content).toMatch(/<div class="col-6 col-sm-3">\s*<q-select\s+v-model="votingFilter"/)
    expect(content).toMatch(/<div class="col-6 col-sm-3">\s*<q-select\s+v-model="votingSort"/)
  })

  it('displays rank and average in showDetailsDialog', () => {
    expect(content).toMatch(/rankMap\.has\(detailsSong\.id\)/)
    expect(content).toMatch(/detailsSong\.voteAverage/)
  })
})
