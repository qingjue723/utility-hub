const MASK = '***'
const QUERY_KEY_PATTERN = /([?&]key=)[^&#\s"']*/gi

export function sanitizeSecret(value: unknown, secret: string) {
  let text = String(value ?? '')
  for (const variant of secretVariants(secret)) text = text.split(variant).join(MASK)
  return text.replace(QUERY_KEY_PATTERN, `$1${MASK}`)
}

export function sanitizeUrl(url: string, secret: string) {
  return sanitizeSecret(url, secret)
}

export function sanitizeHeaders(headers: Record<string, string>, secret: string) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
    const normalized = key.toLowerCase()
    if (normalized === 'authorization') return [key, 'Bearer ***']
    if (normalized === 'x-api-key') return [key, MASK]
    return [key, sanitizeSecret(value, secret)]
  }))
}

function secretVariants(secret: string) {
  if (!secret) return []
  return [...new Set([String(secret), encodeURIComponent(secret)])].filter(Boolean)
}
