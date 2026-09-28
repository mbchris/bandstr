import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Issue #19 Setlist Print & Export remaining open issues', () => {
  it('keeps only the printer icon symbol on top and removes duplicate "Print & Export" buttons', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Top printer symbol must be present
    expect(content).toMatch(/<q-btn\s+flat\s+round\s+icon="print"\s+@click="openPrintExportModal">/)

    // No duplicate buttons with :label="t('setlist.printExport')" in the page body
    expect(content).not.toMatch(/<q-btn[^>]*:label="t\('setlist\.printExport'\)"/)
  })
})
