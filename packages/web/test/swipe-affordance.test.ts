import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  shouldTriggerNudge,
  markNudgeTriggered,
  triggerPeekAnimation,
} from '../src/composables/useSwipeAffordance'

describe('useSwipeAffordance', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('determines if nudge should trigger based on sessionStorage', () => {
    expect(shouldTriggerNudge('voting-songs')).toBe(true)
    markNudgeTriggered('voting-songs')
    expect(shouldTriggerNudge('voting-songs')).toBe(false)
  })

  it('handles multiple feature keys independently', () => {
    expect(shouldTriggerNudge('key1')).toBe(true)
    expect(shouldTriggerNudge('key2')).toBe(true)
    markNudgeTriggered('key1')
    expect(shouldTriggerNudge('key1')).toBe(false)
    expect(shouldTriggerNudge('key2')).toBe(true)
  })

  it('animates element with keyframes when motion is allowed', async () => {
    const el = document.createElement('div')
    const animateSpy = vi.fn().mockReturnValue({ finished: Promise.resolve() })
    el.animate = animateSpy as unknown as typeof el.animate

    await triggerPeekAnimation(el)

    expect(animateSpy).toHaveBeenCalledTimes(1)
    const [keyframes, options] = animateSpy.mock.calls[0]
    expect(Array.isArray(keyframes)).toBe(true)
    expect(options).toMatchObject({
      duration: expect.any(Number),
      easing: expect.any(String),
    })
  })

  it('skips animation safely if element is null', async () => {
    await expect(triggerPeekAnimation(null)).resolves.toBeUndefined()
  })
})
