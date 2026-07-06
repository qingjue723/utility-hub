export function randomInt(maxExclusive: number) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be a positive safe integer')
  }

  const buffer = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % maxExclusive
}

export function randomFrom(charset: string) {
  return charset[randomInt(charset.length)]
}

export function randomItem<T>(items: readonly T[]) {
  return items[randomInt(items.length)]
}
