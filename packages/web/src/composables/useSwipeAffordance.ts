/**
 * useSwipeAffordance
 *
 * Provides non-intrusive visual affordance for swipeable elements:
 * - Session-bounded tracking (ensures hint only runs once per user session)
 * - Micro-peek animation demonstrating the swipe axis physically
 */

const STORAGE_PREFIX = 'bandstr_swipe_hint_'

export function shouldTriggerNudge(featureKey: string): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false
  return sessionStorage.getItem(`${STORAGE_PREFIX}${featureKey}`) !== '1'
}

export function markNudgeTriggered(featureKey: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${featureKey}`, '1')
  } catch {
    // Ignore storage quota or security errors
  }
}

export async function triggerPeekAnimation(element: HTMLElement | null): Promise<void> {
  if (!element) return

  // Respect user preference for reduced motion
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  if (typeof element.animate !== 'function') return

  try {
    // Subtle physical peek:
    // Peek left (-24px) revealing right/archive action slightly
    // Peek right (+24px) revealing left/accept action slightly
    // Settle back to resting state with gentle ease
    const animation = element.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(-24px)', offset: 0.28 },
        { transform: 'translateX(24px)', offset: 0.65 },
        { transform: 'translateX(-4px)', offset: 0.88 },
        { transform: 'translateX(0)', offset: 1.0 },
      ],
      {
        duration: 720,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'none',
      }
    )

    await (animation.finished || Promise.resolve())
  } catch {
    // Safe fallback if web animations api is unsupported
  }
}

export function useSwipeAffordance(featureKey: string) {
  function tryPeek(el: HTMLElement | null | undefined) {
    if (!el || !shouldTriggerNudge(featureKey)) return
    markNudgeTriggered(featureKey)
    // Small delay to allow initial layout paint to complete cleanly
    setTimeout(() => {
      triggerPeekAnimation(el)
    }, 450)
  }

  return {
    shouldTriggerNudge: () => shouldTriggerNudge(featureKey),
    markNudgeTriggered: () => markNudgeTriggered(featureKey),
    triggerPeekAnimation,
    tryPeek,
  }
}
