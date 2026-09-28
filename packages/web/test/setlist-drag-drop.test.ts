import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Setlist Drag & Drop Position Reordering', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('wires dataTransfer setData in onDragStart for cross-browser HTML5 drag support', () => {
    expect(content).toContain("event.dataTransfer.setData('text/plain', String(index))")
    expect(content).toContain("event.dataTransfer.effectAllowed = 'move'")
  })

  it('has dragover and dragleave handlers for drop target tracking', () => {
    expect(content).toContain('function onDragOver')
    expect(content).toContain('function onDragLeave')
    expect(content).toContain('dragOverIndex')
    expect(content).toContain('dropEffect = \'move\'')
  })

  it('wires draggable and touch event handlers to drag handle icon', () => {
    // Drag handle icon must be explicitly draggable to bypass Quasar TouchPan interception
    expect(content).toMatch(/class="[^"]*drag-handle[^"]*"[\s\S]*?draggable="true"/)
    expect(content).toContain('@dragstart.stop="onDragStart(index, $event)"')
    expect(content).toContain('@touchstart.passive="onTouchHandleStart(index, $event)"')
    expect(content).toContain('@touchmove="onTouchHandleMove($event)"')
    expect(content).toContain('@touchend="onTouchHandleEnd"')
  })

  it('wires dragover and drop handlers on both q-slide-item and q-item', () => {
    expect(content).toContain('@dragover.prevent="onDragOver(index, $event)"')
    expect(content).toContain('@drop.prevent="onDrop(index, $event)"')
    expect(content).toContain(':data-song-index="index"')
  })

  it('includes dragging-item and drag-over-item CSS styles', () => {
    expect(content).toContain('.drag-over-item')
    expect(content).toContain('.drag-handle')
    expect(content).toContain('touch-action: none')
  })
})
