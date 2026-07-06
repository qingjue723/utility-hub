import { randomFrom, randomInt } from '../../lib/random'

export type PasswordOptions = {
  length: number
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
  ambiguous: boolean
  minNumber: number
  minSpecial: number
}

export type PasswordResult = {
  value: string
  error?: string
}

const ascii = {
  full: {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    special: '!@#$%^&*',
  },
  unmistakable: {
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    lower: 'abcdefghijkmnopqrstuvwxyz',
    digits: '23456789',
    special: '!@#$%^&*',
  },
}

export const defaultPasswordOptions: PasswordOptions = {
  length: 14,
  uppercase: true,
  lowercase: true,
  number: true,
  special: false,
  ambiguous: false,
  minNumber: 1,
  minSpecial: 1,
}

export function generatePassword(options: PasswordOptions): PasswordResult {
  const source = options.ambiguous ? ascii.full : ascii.unmistakable
  const groups: Array<{ enabled: boolean; min: number; chars: string }> = [
    { enabled: options.lowercase, min: options.lowercase ? 1 : 0, chars: source.lower },
    { enabled: options.uppercase, min: options.uppercase ? 1 : 0, chars: source.upper },
    { enabled: options.number, min: options.number ? Math.max(1, options.minNumber) : 0, chars: source.digits },
    { enabled: options.special, min: options.special ? Math.max(1, options.minSpecial) : 0, chars: source.special },
  ]
  const active = groups.filter((group) => group.enabled)
  const allChars = active.map((group) => group.chars).join('')
  if (!allChars) return { value: '', error: 'selectCharacterType' }

  const required = groups.flatMap((group) => Array.from({ length: group.min }, () => randomFrom(group.chars)))
  const length = clamp(Math.max(options.length, required.length), 5, 128)
  const rest = Array.from({ length: length - required.length }, () => randomFrom(allChars))
  return { value: shuffle([...required, ...rest]).join('') }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}
