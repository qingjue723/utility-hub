import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const outputPath = resolve('src/tools/generate/us-profile-data.generated.ts')
const firstNamesUrl = 'https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_RaceHispanic_Top1000.xlsx'
const lastNamesUrl = 'https://www2.census.gov/topics/genealogy/2020surnames/Names2020_LastNames_RaceHispanic_Top1000.xlsx'
const occupationsUrl = 'https://www.bls.gov/oes/2025/may/oes_stru.htm'
const companiesUrl = 'https://www.sec.gov/files/company_tickers_exchange.json'
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
const safeJobMajorGroups = new Set(['11', '13', '15', '17', '19', '25', '27', '41', '43'])
const jobCategoryNames = ['tech', 'business', 'operations', 'marketing', 'sales', 'design', 'admin', 'education', 'engineering', 'generic']
const curatedJobTitles = [
  'Account Coordinator', 'Account Executive', 'Account Manager', 'Administrative Coordinator', 'Administrative Specialist', 'Analytics Manager', 'Application Developer', 'Associate Product Manager',
  'Brand Manager', 'Business Analyst', 'Business Development Manager', 'Business Operations Analyst', 'Client Services Associate', 'Communications Manager', 'Community Manager', 'Content Editor',
  'Content Marketing Manager', 'Content Strategist', 'Copywriter', 'Creative Producer', 'Customer Experience Manager', 'Customer Success Associate', 'Customer Success Manager', 'Data Analyst',
  'Data Engineer', 'Data Visualization Specialist', 'Database Administrator', 'Demand Generation Manager', 'Design Researcher', 'Digital Marketing Manager', 'Ecommerce Manager', 'Email Marketing Specialist',
  'Event Coordinator', 'Executive Assistant', 'Finance Associate', 'Finance Manager', 'Frontend Engineer', 'Growth Marketing Manager', 'HR Coordinator', 'HR Generalist',
  'Implementation Consultant', 'Information Security Analyst', 'Inside Sales Representative', 'Instructional Designer', 'IT Support Specialist', 'Learning and Development Specialist', 'Logistics Coordinator',
  'Marketing Analyst', 'Marketing Coordinator', 'Marketing Manager', 'Merchandising Analyst', 'Office Manager', 'Operations Analyst', 'Operations Coordinator', 'Operations Manager',
  'Partner Manager', 'People Operations Specialist', 'Product Analyst', 'Product Designer', 'Product Manager', 'Product Marketing Manager', 'Program Coordinator', 'Program Manager',
  'Project Coordinator', 'Project Manager', 'QA Analyst', 'QA Engineer', 'Recruiter', 'Research Analyst', 'Sales Coordinator', 'Sales Development Representative', 'Sales Manager',
  'SEO Specialist', 'Social Media Manager', 'Software Engineer', 'Solutions Consultant', 'Support Engineer', 'Systems Administrator', 'Technical Account Manager', 'Technical Program Manager',
  'Technical Writer', 'Training Coordinator', 'UX Designer', 'UX Researcher', 'Visual Designer', 'Web Developer', 'Workforce Analyst'
]
const companyExclusionPattern = /acquisition|acquiror|spac|blank check|fund|etf|trust|holdings?|income|shares?|warrants?|rights?|units?|notes?|debenture|depositary|adr|preferred|bond|treasury|mortgage|reit|capital|assets?|propert(y|ies)|realty|bancorp|bank|financial|finance|insurance|assurance|brokerage|securities|jpmorgan|chase|wells fargo|citigroup|visa|mastercard|morgan stanley|goldman sachs|berkshire hathaway|casino|gaming|betting|tobacco|philip morris|cannabis|marijuana|psychedelic|crypto|bitcoin|blockchain|firearm|gun|weapon|defense|munitions|rtx|prison|correctional|pharma|therapeutics|biopharma|biotech|\bbio\b|laborator(y|ies)|medical|health|clinical|lilly|merck|novartis|johnson & johnson|unitedhealth|abbvie|oil|gas|energy|petroleum|exxon|chevron|vernova|mining|resources|metals|construction|\/adr|\/uk|\/de|\/new|\.s\.a\.|\bs\.?a\.?\b|\bn\.?v\.?\b|\bag\b|\bltd\.?\b|\bplc\b/i
const jobExclusionPattern = /\b(all other|helpers?--|lawyers?|judges?|magistrates?|police|sheriff|detectives?|criminal|correctional|bailiffs?|firefighters?|military|soldiers?|weapon|explosives?|security guards?|physicians?|surgeons?|nurses?|dentists?|pharmacists?|therapists?|clinical|medical|health|veterinarians?|psychologists?|pilots?|air traffic|drivers?|truck|taxi|ambulance|securities|insurance|financial|investment|credit|loan|tax|accountants?|auditors?|actuaries|claims|gambling|gaming|mining|roofers?|logging|slaughterers?|meat|embalmers?|funeral|clergy|religious|emergency|construction|farm|farmers?|ranchers?|agricultural|aerospace|nuclear|naval|marine engineers|petroleum|chemical engineers|surveyors?)\b/i

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: '*/*',
      Referer: sourceReferer(url),
    },
  })
  if (!response.ok) {
    if (process.platform === 'win32') return fetchBufferWithPowerShell(url)
    throw new Error(`Request failed ${response.status}: ${url}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function fetchBufferWithPowerShell(url) {
  const outputPath = resolve(tmpdir(), `utility-hub-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const command = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${url.replaceAll("'", "''")}' -Headers @{'User-Agent'='${userAgent.replaceAll("'", "''")}'; Referer='${sourceReferer(url).replaceAll("'", "''")}'} -OutFile '${outputPath.replaceAll("'", "''")}'`
  try {
    execFileSync('pwsh', ['-NoProfile', '-Command', command], { stdio: 'pipe' })
  } catch (error) {
    return fetchBufferWithSmartSearch(url)
  }
  return readFileSync(outputPath)
}

function fetchBufferWithSmartSearch(url) {
  const outputPath = resolve(tmpdir(), `utility-hub-profile-smart-search-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const command = `smart-search fetch '${url.replaceAll("'", "''")}' --format content --output '${outputPath.replaceAll("'", "''")}'`
  execFileSync('pwsh', ['-NoProfile', '-Command', command], { stdio: 'pipe' })
  return readFileSync(outputPath)
}

function sourceReferer(url) {
  if (url.includes('census.gov')) return 'https://www.census.gov/topics/population/genealogy/data/2020_names.html'
  if (url.includes('bls.gov')) return 'https://www.bls.gov/oes/data.htm'
  if (url.includes('sec.gov')) return 'https://www.sec.gov/developer'
  return 'https://utility-hub.local/'
}

async function fetchText(url) {
  return (await fetchBuffer(url)).toString('utf8')
}

async function fetchJson(url) {
  const text = await fetchText(url)
  const match = text.match(/```json\s*([\s\S]*?)\s*```/)
  return JSON.parse(match ? match[1] : text)
}

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset)
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset)
}

function unzipEntries(buffer) {
  const eocdSignature = 0x06054b50
  let eocdOffset = -1
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(buffer, offset) === eocdSignature) {
      eocdOffset = offset
      break
    }
  }
  if (eocdOffset < 0) throw new Error('Could not find XLSX central directory')

  const entryCount = readUInt16(buffer, eocdOffset + 10)
  let directoryOffset = readUInt32(buffer, eocdOffset + 16)
  const entries = new Map()

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, directoryOffset) !== 0x02014b50) throw new Error('Invalid ZIP central directory entry')

    const method = readUInt16(buffer, directoryOffset + 10)
    const compressedSize = readUInt32(buffer, directoryOffset + 20)
    const fileNameLength = readUInt16(buffer, directoryOffset + 28)
    const extraLength = readUInt16(buffer, directoryOffset + 30)
    const commentLength = readUInt16(buffer, directoryOffset + 32)
    const localOffset = readUInt32(buffer, directoryOffset + 42)
    const nameStart = directoryOffset + 46
    const name = buffer.toString('utf8', nameStart, nameStart + fileNameLength)

    const localNameLength = readUInt16(buffer, localOffset + 26)
    const localExtraLength = readUInt16(buffer, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null
    if (data) entries.set(name, data.toString('utf8'))

    directoryOffset = nameStart + fileNameLength + extraLength + commentLength
  }

  return entries
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function parseSharedStrings(xml = '') {
  const values = []
  for (const item of xml.matchAll(/<si[\s\S]*?<\/si>/g)) {
    const text = [...item[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('')
    values.push(text)
  }
  return values
}

function parseSheetRows(xml, sharedStrings) {
  const rows = []
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const body = cellMatch[2]
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1]
      const column = ref ? columnIndex(ref) : row.length
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? ''
      const value = attrs.includes('t="s"') ? sharedStrings[Number(rawValue)] ?? '' : decodeXml(rawValue)
      row[column] = value
    }
    rows.push(row)
  }
  return rows
}

function columnIndex(column) {
  let index = 0
  for (const char of column) index = index * 26 + char.charCodeAt(0) - 64
  return index - 1
}

async function readXlsxRows(url) {
  const entries = unzipEntries(await fetchBuffer(url))
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml'))
  const sheet = entries.get('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error(`Could not find first worksheet: ${url}`)
  return parseSheetRows(sheet, sharedStrings)
}

function titleCaseName(value) {
  return value.toLowerCase().replace(/(^|[ '\-])[a-z]/g, (part) => part.toUpperCase())
}

function dedupe(values) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

function extractNames(rows, limit) {
  const headerWords = new Set(['name', 'firstname', 'first name', 'lastname', 'last name', 'rank', 'count', 'pctapi', 'pctaian', 'pctblack', 'pcthispanic', 'pctnhpi', 'pctsor', 'pcttomr', 'pctwhite'])
  const headerPattern = /\b(cumulative|proportion|hispanic|origin|alone|population|race)\b/i
  const values = rows.flatMap((row) => row)
    .map((value) => String(value ?? '').replace(/\s+/g, ' ').trim())
    .filter((value) => /^[A-Z][A-Z' -]{1,40}$/.test(value))
    .filter((value) => !headerWords.has(value.toLowerCase()))
    .filter((value) => !headerPattern.test(value))
    .map(titleCaseName)
  return dedupe(values).slice(0, limit)
}

async function buildNames() {
  const [firstRows, lastRows] = await Promise.all([readXlsxRows(firstNamesUrl), readXlsxRows(lastNamesUrl)])
  const firstNames = extractNames(firstRows, 1000)
  const lastNames = extractNames(lastRows, 1000)
  if (firstNames.length !== 1000) throw new Error(`Expected 1000 first names, got ${firstNames.length}`)
  if (lastNames.length !== 1000) throw new Error(`Expected 1000 last names, got ${lastNames.length}`)
  return { firstNames, lastNames }
}

async function buildJobTitles() {
  const body = await fetchText(occupationsUrl)
  const sourceTitles = [...body.matchAll(/(\d{2}-\d{4})\[([^\]]+)\]/g)]
    .map((match) => ({ code: match[1], title: match[2].replace(/\s+/g, ' ').trim() }))
    .filter(({ code }) => !code.endsWith('0'))
    .filter(({ code }) => safeJobMajorGroups.has(code.slice(0, 2)))
    .map(({ title }) => title)
    .filter((title) => !jobExclusionPattern.test(title))
  return groupJobTitles(dedupe([...sourceTitles, ...curatedJobTitles]))
}

function groupJobTitles(titles) {
  const groups = Object.fromEntries(jobCategoryNames.map((category) => [category, []]))
  for (const title of titles) groups[categorizeJobTitle(title)].push(title)
  return Object.fromEntries(Object.entries(groups).map(([category, values]) => [category, dedupe(values)]))
}

function categorizeJobTitle(title) {
  const value = title.toLowerCase()
  if (/software|web|database|network|computer|systems|application|data engineer|data scientist|information security|programmer|support engineer|it support|frontend|qa engineer/.test(value)) return 'tech'
  if (/marketing|advertising|promotions|public relations|communications|seo|content marketing|brand manager|demand generation|market research|social media/.test(value)) return 'marketing'
  if (/sales|account executive|account manager|business development|customer success|client services|inside sales|solutions consultant|partner manager/.test(value)) return 'sales'
  if (/design|designer|ux|visual|creative|artist|editor|writer|copywriter|producer|media|photographer|content strategist/.test(value)) return 'design'
  if (/education|teacher|instructional|training|learning and development/.test(value)) return 'education'
  if (/engineer|architect|drafter|materials|electrical|electronics|mechanical|civil|environmental|industrial/.test(value)) return 'engineering'
  if (/administrative|assistant|office|secretar|clerk|reception|human resources|hr |recruiter|people operations/.test(value)) return 'admin'
  if (/operations|logistic|production|purchasing|facilities|transportation|storage|distribution|project|program|coordinator|event|workforce/.test(value)) return 'operations'
  if (/analyst|manager|management|business|budget|compliance|cost estimator|specialist|consultant|research|executive|chief/.test(value)) return 'business'
  return 'generic'
}

async function buildCompanyNames() {
  const data = await fetchJson(companiesUrl)
  const rows = Array.isArray(data.data) ? data.data : Object.values(data)
  const fieldIndex = Array.isArray(data.fields) ? data.fields.indexOf('name') : -1
  const names = dedupe(rows.map((row) => {
    if (Array.isArray(row)) return row[fieldIndex >= 0 ? fieldIndex : 1]
    return row?.name ?? row?.title ?? ''
  }).filter(Boolean).filter((name) => !companyExclusionPattern.test(name)))
  return names.map((name) => ({ name, category: categorizeCompanyName(name) }))
}

function categorizeCompanyName(name) {
  const value = name.toLowerCase()
  if (/school|academy|education|learning|university|college/.test(value)) return 'education'
  if (/media|entertainment|studio|broadcast|publishing|communications|netflix|disney|news|music|audio/.test(value)) return 'media'
  if (/retail|store|market|brands|apparel|fashion|restaurant|food|beverage|coca cola|walmart|home depot|consumer|ecommerce|shop/.test(value)) return 'retail'
  if (/software|data|digital|network|semiconductor|micro|systems|solutions|electronics|cloud|cyber|tech|technolog|oracle|cisco|intel|nvidia|apple|microsoft|alphabet|amazon|meta|palantir|sandisk|kls|lam research|palo alto/.test(value)) return 'tech'
  if (/industrial|manufactur|materials|machinery|electric|general electric|caterpillar|automation|aerospace|components|equipment|packaging/.test(value)) return 'industrial'
  return 'generic'
}

function serializeArray(name, values) {
  return `export const ${name} = ${JSON.stringify(values, null, 2)} as const`
}

function serialize({ firstNames, lastNames, companyNames, jobTitles }) {
  return `// Generated by scripts/build-us-profile-data.mjs.
// Sources:
// - U.S. Census 2020 Frequently Occurring First Names and Last Names: top 1,000 public aggregate names.
// - BLS OEWS occupation profiles plus curated office/tech titles: filtered for general registration-style profiles.
// - SEC company_tickers_exchange.json: exchange-listed company names filtered to remove securities-shell, fund, regulated, and sensitive entities.

${serializeArray('usFirstNames', firstNames)}

${serializeArray('usLastNames', lastNames)}

${serializeArray('usCompanyProfiles', companyNames)}

${serializeArray('usJobTitlesByCategory', jobTitles)}
`
}

const [{ firstNames, lastNames }, jobTitles, companyNames] = await Promise.all([
  buildNames(),
  buildJobTitles(),
  buildCompanyNames(),
])

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, serialize({ firstNames, lastNames, companyNames, jobTitles }))

console.log(`Wrote profile data to ${outputPath}`)
console.log(`First names: ${firstNames.length}`)
console.log(`Last names: ${lastNames.length}`)
console.log(`Company names: ${companyNames.length}`)
console.log(`Job titles: ${Object.values(jobTitles).reduce((total, titles) => total + titles.length, 0)}`)
for (const [category, titles] of Object.entries(jobTitles)) console.log(`Job titles (${category}): ${titles.length}`)
