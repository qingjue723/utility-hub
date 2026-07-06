import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

const outputPath = resolve('src/tools/generate/us-addresses.generated.ts')
const apiUrl = 'https://batch.openaddresses.io/api/data'
const dataUrl = (job) => `https://v2.openaddresses.io/batch-prod/job/${job}/source.geojson.gz`

const targets = new Map([
  ['AK', 200], ['DE', 200], ['MT', 200], ['NH', 200], ['OR', 200],
  ['CA', 100], ['NY', 100], ['TX', 100], ['FL', 100], ['WA', 100], ['IL', 100],
  ['CO', 50], ['DC', 50], ['GA', 50], ['MA', 50], ['MI', 50], ['MN', 50], ['NC', 50], ['NE', 50], ['PA', 50], ['RI', 50],
])

const sourcePriority = new Map([
  ['DE', ['statewide', 'new_castle', 'sussex', 'kent', 'city_of_dover', 'city_of_newark']],
  ['MT', ['statewide', 'yellowstone', 'missoula', 'gallatin', 'flathead', 'lewis_and_clark', 'cascade']],
  ['NH', ['statewide', 'city_of_nashua', 'milford', 'city_of_auburn', 'jaffrey']],
  ['OR', ['portland', 'multnomah', 'washington', 'marion', 'clackamas', 'lane', 'deschutes']],
  ['AK', ['anchorage', 'fairbanks_north_star_borough', 'matanuska_susitna', 'juneau', 'kenai_peninsula_borough']],
])

const cityZipFallback = new Map([
  ['NH|ACWORTH', '03601'], ['NH|AUBURN', '03032'], ['NH|HAMPSTEAD', '03841'], ['NH|JAFFREY', '03452'], ['NH|MILFORD', '03055'], ['NH|NASHUA', '03060'],
  ['NH|CONCORD', '03301'], ['NH|MANCHESTER', '03101'], ['NH|PORTSMOUTH', '03801'], ['NH|DOVER', '03820'], ['NH|KEENE', '03431'], ['NH|LEBANON', '03766'],
])

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function zip5(value) {
  const match = clean(value).match(/\d{5}/)
  return match ? match[0] : ''
}

function titleCase(value) {
  return clean(value).toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).replace(/\bNw\b|\bNe\b|\bSw\b|\bSe\b/g, (part) => part.toUpperCase())
}

function normalizeFeature(feature, fallbackState) {
  const properties = feature.properties ?? {}
  const coordinates = feature.geometry?.coordinates
  const longitude = Number(coordinates?.[0])
  const latitude = Number(coordinates?.[1])
  const state = clean(properties.region || fallbackState).toUpperCase()
  const number = clean(properties.number)
  const streetName = titleCase(properties.street)
  const city = titleCase(properties.city || properties.district)
  const zip = zip5(properties.postcode) || cityZipFallback.get(`${state}|${clean(properties.city).toUpperCase()}`) || ''

  if (!number || !streetName || !city || !state || !zip || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (state !== fallbackState) return null
  if (latitude < 18 || latitude > 72 || longitude < -180 || longitude > -60) return null

  return {
    street: `${number} ${streetName}`,
    city,
    state,
    zip,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  }
}

function sourceRank(source, state) {
  const id = source.split('/').at(-1) ?? source
  const priority = sourcePriority.get(state) ?? []
  const index = priority.findIndex((item) => id.includes(item))
  if (index >= 0) return index
  return 1000
}

function pickEveryNth(items, targetCount) {
  if (items.length <= targetCount) return items
  const result = []
  const step = items.length / targetCount
  for (let index = 0; index < targetCount; index += 1) {
    result.push(items[Math.floor(index * step)])
  }
  return result
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`)
  return response.json()
}

async function fetchSource(job) {
  const response = await fetch(dataUrl(job))
  if (!response.ok) throw new Error(`Source failed ${response.status}: ${job}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  return gunzipSync(buffer).toString('utf8')
}

async function collectState(state, rows, target) {
  const collected = []
  const seen = new Set()
  const sources = rows
    .filter((row) => row.layer === 'addresses' && row.output?.output && row.source?.startsWith(`us/${state.toLowerCase()}/`))
    .sort((a, b) => sourceRank(a.source, state) - sourceRank(b.source, state) || Number(a.size || 0) - Number(b.size || 0))

  for (const source of sources) {
    if (collected.length >= target) break
    try {
      const body = await fetchSource(source.job)
      const local = []
      for (const line of body.split('\n')) {
        if (!line.trim()) continue
        const address = normalizeFeature(JSON.parse(line), state)
        if (!address) continue
        const key = `${address.street}|${address.city}|${address.state}|${address.zip}`.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        local.push(address)
      }
      for (const address of pickEveryNth(local, Math.max(0, target - collected.length))) collected.push(address)
      console.log(`${state}: ${collected.length}/${target} after ${source.source}`)
    } catch (error) {
      console.warn(`${state}: skipped ${source.source} (${error.message})`)
    }
  }

  return collected
}

function serialize(addresses) {
  const body = addresses
    .map((address) => `  ${JSON.stringify(address).replace(/"([^"\\]+)":/g, '$1:')},`)
    .join('\n')

  return `export type RealUsAddress = {\n  street: string\n  city: string\n  state: string\n  zip: string\n  latitude: number\n  longitude: number\n}\n\nexport const realUsAddresses: readonly RealUsAddress[] = [\n${body}\n]\n\nexport const usStates = Array.from(new Set(realUsAddresses.map((address) => address.state))).sort()\n`
}

const rows = await fetchJson(apiUrl)
const addresses = []
for (const [state, target] of targets) {
  addresses.push(...await collectState(state, rows, target))
}

addresses.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.street.localeCompare(b.street))
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, serialize(addresses))

const counts = Map.groupBy(addresses, (address) => address.state)
console.log(`Wrote ${addresses.length} addresses to ${outputPath}`)
for (const [state, stateRows] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${state}: ${stateRows.length}`)
}
