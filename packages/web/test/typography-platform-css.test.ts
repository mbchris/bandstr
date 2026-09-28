import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('typography & platform styling guidelines', () => {
  const webSrcDir = path.resolve(__dirname, '../src')

  it('sets body font size to 15px in quasar.variables.scss', () => {
    const quasarVarsPath = path.resolve(webSrcDir, 'css/quasar.variables.scss')
    const content = fs.readFileSync(quasarVarsPath, 'utf8')
    expect(content).toMatch(/\$body-font-size\s*:\s*15px;/)
  })

  it('imports platform.scss in app.scss', () => {
    const appScssPath = path.resolve(webSrcDir, 'css/app.scss')
    const content = fs.readFileSync(appScssPath, 'utf8')
    expect(content).toMatch(/@import\s+['"].\/platform\.scss['"];|@use\s+['"].\/platform['"];|platform\.scss/)
  })

  it('defines platform-scoped styling and iOS sheet grabber in platform.scss', () => {
    const platformScssPath = path.resolve(webSrcDir, 'css/platform.scss')
    expect(fs.existsSync(platformScssPath)).toBe(true)
    const content = fs.readFileSync(platformScssPath, 'utf8')
    expect(content).toContain('.platform-ios')
    expect(content).toContain('.ios-sheet-grabber')
  })

  it('enforces 10px minimum font size across vue templates (no 8px or 9px)', () => {
    function scanDir(dir: string): string[] {
      const results: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.resolve(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...scanDir(fullPath))
        } else if (entry.name.endsWith('.vue')) {
          const content = fs.readFileSync(fullPath, 'utf8')
          if (/font-size:\s*[1-9]px\b/.test(content)) {
            const matches = content.match(/font-size:\s*[1-9]px\b/g) || []
            for (const m of matches) {
              results.push(`${entry.name}: ${m}`)
            }
          }
        }
      }
      return results
    }

    const sub10pxOccurrences = scanDir(webSrcDir)
    expect(sub10pxOccurrences).toEqual([])
  })
})
