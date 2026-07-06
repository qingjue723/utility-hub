export function readStoredValue<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export function writeStoredValue<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable in private contexts.
  }
}

export function removeStoredValue(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in private contexts.
  }
}
