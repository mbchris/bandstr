function isUsableBuildId(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return Boolean(normalized) && normalized !== 'unknown' && normalized !== 'dev'
}

export function resolveBuildIdFromEnvironment(): string {
  const candidates = [process.env.GIT_REV ?? '', process.env.SOURCE_COMMIT ?? '']
  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (isUsableBuildId(trimmed)) {
      return trimmed
    }
  }
  return ''
}
