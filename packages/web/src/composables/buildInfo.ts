function isUsableBuildId(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return Boolean(normalized) && normalized !== 'unknown' && normalized !== 'dev'
}

export function resolveBuildIdFromEnv(fallback = 'unknown'): string {
  const candidates = [process.env.GIT_REV ?? '', process.env.SOURCE_COMMIT ?? '']
  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (isUsableBuildId(trimmed)) {
      return trimmed
    }
  }
  return fallback
}

export async function fetchRuntimeBuildId(): Promise<string | null> {
  try {
    const base = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
    const response = await fetch(`${base}/api/health`)
    if (!response.ok) return null
    const payload = (await response.json()) as { version?: string }
    const runtimeRev = (payload.version ?? '').trim()
    if (!runtimeRev || !isUsableBuildId(runtimeRev)) return null
    return runtimeRev
  } catch {
    return null
  }
}
