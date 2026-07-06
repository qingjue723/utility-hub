export function linesOf(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function base64Decode(value: string) {
  const binary = atob(value.trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export async function digestText(value: string, algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512') {
  const hash = await crypto.subtle.digest(algorithm, new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
