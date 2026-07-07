import { getResponseText } from './apiFormatCore'
import type { ApiFormat, TFunction } from './apiFormatTypes'

export function parseJson(raw: string) {
  try { return { ok: true as const, value: JSON.parse(raw), error: '' } } catch (error) { return { ok: false as const, value: null, error: error instanceof Error ? error.message : 'Invalid JSON' } }
}

export function parseSseEvents(raw: string) {
  const events: unknown[] = []
  const invalid: string[] = []
  const lines = String(raw || '').split(/\r?\n/)
  let dataLines: string[] = []
  let done = false

  const flush = () => {
    if (!dataLines.length || done) {
      dataLines = []
      return
    }
    const data = dataLines.join('\n')
    dataLines = []
    if (data === '[DONE]') {
      done = true
      return
    }
    const parsed = parseJson(data)
    if (parsed.ok) events.push(parsed.value)
    else invalid.push(data)
  }

  for (const line of lines) {
    if (line === '') {
      flush()
      continue
    }
    if (line.startsWith(':') || done) continue
    const separator = line.indexOf(':')
    const field = separator >= 0 ? line.slice(0, separator) : line
    let value = separator >= 0 ? line.slice(separator + 1) : ''
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data' && value === '[DONE]' && !dataLines.length) done = true
    else if (field === 'data') dataLines.push(value)
  }
  flush()
  return { events, invalid, done }
}

export function parseStreamText(format: ApiFormat, raw: string, t: TFunction) {
  const { events, invalid } = parseSseEvents(raw)
  if (invalid.length) return { ok: false, text: '', error: t.apiFormatSseDataNotJson }
  if (!events.length) return parseNonSseStream(format, raw, t)
  const text = events.map((json) => streamEventText(format, json)).join('')
  return { ok: Boolean(text), text, error: text ? '' : t.apiFormatSseNoText }
}

function parseNonSseStream(format: ApiFormat, raw: string, t: TFunction) {
  const parsed = parseJson(raw)
  if (!parsed.ok) return { ok: false, text: '', error: t.apiFormatSseNonSseJson }
  const text = getResponseText(format, parsed.value)
  return { ok: Boolean(text), text, error: text ? '' : t.apiFormatSseJsonNoText }
}

function streamEventText(format: ApiFormat, json: any) {
  if (format === 'chat') return json.choices?.[0]?.delta?.content || ''
  if (format === 'responses') return json.delta || getResponseText(format, json)
  if (format === 'claude') return json.delta?.text || ''
  return getResponseText(format, json)
}
