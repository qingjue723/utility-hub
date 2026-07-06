import { readStoredValue, writeStoredValue } from '../../lib/storage'

export type RatesResult = {
  base: string
  date: string
  provider: string
  rates: Record<string, number>
  cached: boolean
}

const CACHE_TTL_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

type CacheEntry = Omit<RatesResult, 'cached'> & { savedAt: number }

function cacheKey(base: string) {
  return `utility-hub-currency-rates-v1-${base}`
}

function readCache(base: string): RatesResult | null {
  const cached = readStoredValue<CacheEntry>(cacheKey(base))
  if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return null
  return { base: cached.base, date: cached.date, provider: cached.provider, rates: cached.rates, cached: true }
}

function writeCache(result: Omit<RatesResult, 'cached'>) {
  writeStoredValue<CacheEntry>(cacheKey(result.base), { ...result, savedAt: Date.now() })
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

function normalizeRates(base: string, rates: Record<string, number>) {
  const normalized: Record<string, number> = { [base]: 1 }
  for (const [code, value] of Object.entries(rates)) {
    if (Number.isFinite(value) && value > 0) normalized[code.toUpperCase()] = value
  }
  return normalized
}

async function fromFawaz(base: string, url: string): Promise<RatesResult> {
  const lowerBase = base.toLowerCase()
  const data = await fetchJson<{ date?: string } & Record<string, Record<string, number> | string>>(`${url}/${lowerBase}.json`)
  const rawRates = data[lowerBase]
  if (!rawRates || typeof rawRates !== 'object') throw new Error('Invalid fawazahmed0 response')
  return {
    base,
    date: typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10),
    provider: 'fawazahmed0/currency-api',
    rates: normalizeRates(base, rawRates as Record<string, number>),
    cached: false,
  }
}

async function fromOpenErApi(base: string): Promise<RatesResult> {
  const data = await fetchJson<{ result?: string; time_last_update_utc?: string; rates?: Record<string, number> }>(`https://open.er-api.com/v6/latest/${base}`)
  if (data.result !== 'success' || !data.rates) throw new Error('Invalid open.er-api.com response')
  return {
    base,
    date: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    provider: 'open.er-api.com / ExchangeRate-API',
    rates: normalizeRates(base, data.rates),
    cached: false,
  }
}

async function fromFrankfurter(base: string): Promise<RatesResult> {
  const data = await fetchJson<{ date?: string; rates?: Record<string, number> }>(`https://api.frankfurter.app/latest?from=${base}`)
  if (!data.rates) throw new Error('Invalid Frankfurter response')
  return {
    base,
    date: data.date ?? new Date().toISOString().slice(0, 10),
    provider: 'Frankfurter',
    rates: normalizeRates(base, data.rates),
    cached: false,
  }
}

export async function fetchRates(base: string): Promise<RatesResult> {
  const normalizedBase = base.toUpperCase()
  const cached = readCache(normalizedBase)
  if (cached) return cached

  const providers = [
    () => fromFawaz(normalizedBase, 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'),
    () => fromFawaz(normalizedBase, 'https://latest.currency-api.pages.dev/v1/currencies'),
    () => fromOpenErApi(normalizedBase),
    () => fromFrankfurter(normalizedBase),
  ]

  let lastError: unknown
  for (const provider of providers) {
    try {
      const result = await provider()
      writeCache(result)
      return result
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to fetch exchange rates')
}
