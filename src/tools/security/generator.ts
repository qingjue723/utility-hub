import { randomFrom, randomInt, randomItem } from '../../lib/random'
import { chinesePinyinWordList, englishWordList } from './wordlists.generated'
export { defaultPasswordOptions, generatePassword, type PasswordOptions } from './passwordCore'

export type GeneratorMode = 'password' | 'passphrase' | 'username'
export type WordListKind = 'english' | 'chinese'
export type SeparatorKind = 'hyphen' | 'space' | 'period' | 'none' | 'custom'
export type UsernameKind = 'word' | 'random' | 'catchall' | 'gmailAlias'

export type PassphraseOptions = {
  wordList: WordListKind
  wordCount: number
  separator: string
  capitalize: boolean
  includeNumber: boolean
}

export type UsernameOptions = {
  type: UsernameKind
  wordList: WordListKind
  capitalize: boolean
  includeNumber: boolean
  randomLength: number
  domain: string
  gmailEmail: string
  gmailUseDots: boolean
  gmailUsePlus: boolean
  gmailPlusTags: string
  gmailUseCase: boolean
  gmailUseGooglemail: boolean
}

export type GeneratedItem = {
  value: string
  hint?: string
}

export type GeneratedResult = {
  value: string
  items?: GeneratedItem[]
  hint?: string
  error?: string
}

const usernameChars = 'abcdefghijklmnopqrstuvwxyz1234567890'

export const defaultPassphraseOptions: PassphraseOptions = {
  wordList: 'english',
  wordCount: 5,
  separator: '-',
  capitalize: false,
  includeNumber: false,
}

export const defaultUsernameOptions: UsernameOptions = {
  type: 'word',
  wordList: 'english',
  capitalize: true,
  includeNumber: true,
  randomLength: 8,
  domain: '',
  gmailEmail: '',
  gmailUseDots: true,
  gmailUsePlus: true,
  gmailPlusTags: '',
  gmailUseCase: false,
  gmailUseGooglemail: false,
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function separatorFromKind(kind: SeparatorKind, custom: string) {
  if (kind === 'space') return ' '
  if (kind === 'period') return '.'
  if (kind === 'none') return ''
  if (kind === 'custom') return custom.slice(0, 1)
  return '-'
}

export function generatePassphrase(options: PassphraseOptions): GeneratedResult {
  const wordCount = clamp(Math.round(options.wordCount), 3, 20)
  if (options.wordList === 'chinese') {
    const words = Array.from({ length: wordCount }, () => randomItem(chinesePinyinWordList))
    const numberIndex = options.includeNumber ? randomInt(words.length) : -1
    const values = words.map((word, index) => {
      const value = applyWordOptions(word.pinyin, options.capitalize)
      return index === numberIndex ? `${value}${randomInt(10)}` : value
    })
    return { value: values.join(options.separator), hint: words.map((word) => word.hanzi).join(' ') }
  }

  const words = Array.from({ length: wordCount }, () => randomItem(englishWordList))
  const numberIndex = options.includeNumber ? randomInt(words.length) : -1
  const values = words.map((word, index) => {
    const value = applyWordOptions(word, options.capitalize)
    return index === numberIndex ? `${value}${randomInt(10)}` : value
  })
  return { value: values.join(options.separator) }
}

export function generateUsername(options: UsernameOptions): GeneratedResult {
  if (options.type === 'random') {
    const length = clamp(Math.round(options.randomLength), 4, 32)
    return { value: Array.from({ length }, () => randomFrom(usernameChars)).join('') }
  }

  if (options.type === 'gmailAlias') return generateGmailAliases(options, 1)
  if (options.type === 'catchall') return generateCatchall(options)
  return generateWordUsername(options)
}

export function generateGmailAliases(options: UsernameOptions, maxCount: number): GeneratedResult {
  const parsed = parseGmailAddress(options.gmailEmail)
  if (!parsed) return { value: options.gmailEmail.trim(), error: 'invalidGmailEmail' }

  const count = clamp(Math.round(maxCount), 1, 256)
  const useDots = options.gmailUseDots && parsed.local.length > 1
  if (!useDots && !options.gmailUsePlus && !options.gmailUseCase && !options.gmailUseGooglemail) {
    return { value: '', error: 'gmailAliasRuleRequired' }
  }

  const tags = options.gmailUsePlus ? gmailPlusTags(options, count) : []

  const domains = options.gmailUseGooglemail ? [parsed.domain, alternateGmailDomain(parsed.domain)] : [parsed.domain]
  const locals = useDots ? gmailDotLocals(parsed.local, count + 1) : Array.from({ length: options.gmailUseCase ? count * 2 : 1 }, () => parsed.local)
  const aliases = new Set<string>()

  for (const local of locals) {
    const localValue = options.gmailUseCase ? randomizeCase(local) : local
    for (const domain of domains) {
      if (local !== parsed.local || domain !== parsed.domain || options.gmailUseCase) {
        aliases.add(`${localValue}@${domain}`)
        if (aliases.size >= count) return gmailAliasResult(aliases)
      }

      for (const tag of tags) {
        aliases.add(`${localValue}+${tag}@${domain}`)
        if (aliases.size >= count) return gmailAliasResult(aliases)
      }
    }
  }

  return gmailAliasResult(aliases)
}

function parseGmailAddress(input: string) {
  const email = input.trim().toLowerCase()
  const atIndex = email.indexOf('@')
  if (atIndex < 1 || atIndex !== email.lastIndexOf('@') || atIndex >= email.length - 1) return null

  const domain = email.slice(atIndex + 1)
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null

  const local = email.slice(0, atIndex).split('+')[0].replace(/\./g, '')
  if (!/^[a-z0-9]+$/.test(local)) return null
  return { local, domain }
}

function gmailDotLocals(local: string, limit: number) {
  const values: string[] = []

  function visit(index: number, value: string) {
    if (values.length >= limit) return
    if (index >= local.length) {
      values.push(value)
      return
    }

    visit(index + 1, `${value}${local[index]}`)
    if (index > 0) visit(index + 1, `${value}.${local[index]}`)
  }

  visit(0, '')
  return values
}

function gmailPlusTags(options: UsernameOptions, count: number) {
  const tags = options.gmailPlusTags
    .split(/[\s,;]+/)
    .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 24))
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index)

  while (tags.length < count) {
    const tag = Array.from({ length: 8 }, () => randomFrom(usernameChars)).join('')
    if (!tags.includes(tag)) tags.push(tag)
  }

  return tags
}

function alternateGmailDomain(domain: string) {
  return domain === 'gmail.com' ? 'googlemail.com' : 'gmail.com'
}

function randomizeCase(value: string) {
  return Array.from(value, (char) => (/[a-z]/.test(char) && randomInt(2) === 1 ? char.toUpperCase() : char)).join('')
}

function gmailAliasResult(aliases: Set<string>): GeneratedResult {
  const items = Array.from(aliases).map((value) => ({ value }))
  return { value: items.map((item) => item.value).join('\n'), items }
}

function generateWordUsername(options: UsernameOptions): GeneratedResult {
  if (options.wordList === 'chinese') {
    const word = randomItem(chinesePinyinWordList)
    return { value: withUsernameNumber(applyWordOptions(word.pinyin, options.capitalize), options.includeNumber), hint: word.hanzi }
  }

  const word = randomItem(englishWordList)
  return { value: withUsernameNumber(applyWordOptions(word, options.capitalize), options.includeNumber) }
}

function generateCatchall(options: UsernameOptions): GeneratedResult {
  const domain = options.domain.trim().replace(/^@/, '')
  if (!domain || !domain.includes('.')) return { value: '', error: 'invalidDomain' }
  return { value: `${Array.from({ length: 8 }, () => randomFrom(usernameChars)).join('')}@${domain}` }
}

function withUsernameNumber(value: string, includeNumber: boolean) {
  if (!includeNumber) return value
  return `${value}${String(randomInt(9999) + 1).padStart(4, '0')}`
}

function applyWordOptions(word: string, capitalize: boolean) {
  if (!capitalize) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function wordListSize(kind: WordListKind) {
  return kind === 'chinese' ? chinesePinyinWordList.length : englishWordList.length
}

export function entropyBits(kind: WordListKind, wordCount: number) {
  return Math.log2(wordListSize(kind)) * wordCount
}
