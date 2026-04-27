export function getInitials(name?: string | null): string {
  const normalized = (name ?? '').trim().replace(/\s+/g, ' ')
  if (!normalized) return '?'

  const parts = normalized.split(' ')
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  const first = parts[0].charAt(0)
  const last = parts[parts.length - 1].charAt(0)
  return `${first}${last}`.toUpperCase()
}
