import { FORMAT_META, TEXT_TOKEN_LIMIT, TOOL_TOKEN_LIMIT } from './apiFormatConstants'
import type { ApiFormat, ApiFormatConfig, ApiMode } from './apiFormatTypes'

const ANTHROPIC_VERSION = '2023-06-01'

export function getAuthMode(format: ApiFormat) {
  if (format === 'claude') return 'x-api-key'
  if (format === 'gemini') return 'query-key'
  return 'bearer'
}

export function getHeaders(format: ApiFormat, cfg: ApiFormatConfig, hasJsonBody: boolean) {
  const headers: Record<string, string> = {}
  const authMode = getAuthMode(format)
  if (hasJsonBody) headers['Content-Type'] = 'application/json'
  if (authMode === 'bearer' && cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  if (authMode === 'x-api-key' && cfg.apiKey) headers['x-api-key'] = cfg.apiKey
  if (format === 'claude') {
    headers['anthropic-version'] = ANTHROPIC_VERSION
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }
  return headers
}

export function getFormatPath(format: ApiFormat, model: string, mode: ApiMode) {
  if (format !== 'gemini') return FORMAT_META[format].path ?? ''
  const suffix = mode === 'stream' ? 'streamGenerateContent?alt=sse' : 'generateContent'
  return `/v1beta/models/${encodeURIComponent(geminiModelId(model))}:${suffix}`
}

export function geminiModelId(model: string) {
  return String(model || '').replace(/^models\//, '')
}

export function canonicalModelName(model: string) {
  return String(model || '').replace(/^models\//, '')
}

export function toolSchema(format: ApiFormat) {
  const jsonSchema = {
    type: 'object',
    properties: { sentence: { type: 'string', description: 'The exact sentence requested by the user.' } },
    required: ['sentence'],
  }
  if (format === 'chat') return { type: 'function', function: { name: 'return_exact_phrase', description: 'Return the exact sentence requested by the user.', parameters: jsonSchema } }
  if (format === 'responses') return { type: 'function', name: 'return_exact_phrase', description: 'Return the exact sentence requested by the user.', parameters: jsonSchema }
  if (format === 'claude') return { name: 'return_exact_phrase', description: 'Return the exact sentence requested by the user.', input_schema: jsonSchema }
  return {
    functionDeclarations: [{
      name: 'return_exact_phrase',
      description: 'Return the exact sentence requested by the user.',
      parameters: { type: 'OBJECT', properties: { sentence: { type: 'STRING' } }, required: ['sentence'] },
    }],
  }
}

export function requestBody(format: ApiFormat, cfg: ApiFormatConfig, mode: ApiMode) {
  const prompt = mode === 'tool'
    ? `Call the function return_exact_phrase with sentence '${cfg.expectedText}'. Do not answer directly.`
    : `Please reply exactly with this sentence and nothing else: ${cfg.expectedText}`
  const isTool = mode === 'tool'
  if (format === 'chat') return chatBody(cfg, prompt, isTool, mode === 'stream')
  if (format === 'responses') return responsesBody(cfg, prompt, isTool, mode === 'stream')
  if (format === 'claude') return claudeBody(cfg, prompt, isTool, mode === 'stream')
  return geminiBody(prompt, isTool)
}

function chatBody(cfg: ApiFormatConfig, prompt: string, isTool: boolean, isStream: boolean) {
  const body: Record<string, unknown> = { model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: TEXT_TOKEN_LIMIT, temperature: 0 }
  if (isStream) body.stream = true
  if (isTool) Object.assign(body, { tools: [toolSchema('chat')], tool_choice: 'auto', max_tokens: TOOL_TOKEN_LIMIT })
  return body
}

function responsesBody(cfg: ApiFormatConfig, prompt: string, isTool: boolean, isStream: boolean) {
  const body: Record<string, unknown> = { model: cfg.model, input: prompt, max_output_tokens: TEXT_TOKEN_LIMIT, temperature: 0 }
  if (isStream) body.stream = true
  if (isTool) Object.assign(body, { tools: [toolSchema('responses')], tool_choice: 'auto', max_output_tokens: TOOL_TOKEN_LIMIT })
  return body
}

function claudeBody(cfg: ApiFormatConfig, prompt: string, isTool: boolean, isStream: boolean) {
  const body: Record<string, unknown> = { model: cfg.model, max_tokens: TEXT_TOKEN_LIMIT, temperature: 0, messages: [{ role: 'user', content: prompt }] }
  if (isStream) body.stream = true
  if (isTool) Object.assign(body, { tools: [toolSchema('claude')], tool_choice: { type: 'auto' }, max_tokens: TOOL_TOKEN_LIMIT })
  return body
}

function geminiBody(prompt: string, isTool: boolean) {
  const body: Record<string, unknown> = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: TEXT_TOKEN_LIMIT } }
  if (isTool) {
    Object.assign(body, { tools: [toolSchema('gemini')], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } })
    body.generationConfig = { temperature: 0, maxOutputTokens: TOOL_TOKEN_LIMIT }
  }
  return body
}

export function getResponseText(format: ApiFormat, json: any) {
  if (!json) return ''
  if (format === 'chat') return firstText([json.choices?.[0]?.message?.content, json.choices?.[0]?.delta?.content])
  if (format === 'responses') return responseApiText(json)
  if (format === 'claude') return (json.content || []).map((item: any) => item.text || '').join('')
  return (json.candidates || []).flatMap((c: any) => c.content?.parts || []).map((p: any) => p.text || '').join('')
}

export function responseApiText(json: any) {
  if (json.output_text) return json.output_text
  return (json.output || []).flatMap((item: any) => item.content || []).map((part: any) => part.text || part.output_text || '').join('')
}

export function hasToolCall(format: ApiFormat, json: any) {
  if (!json) return false
  if (format === 'chat') return Boolean(json.choices?.[0]?.message?.tool_calls?.length || json.choices?.[0]?.delta?.tool_calls?.length)
  if (format === 'responses') return (json.output || []).some((item: any) => item.type === 'function_call' || item.type === 'tool_call')
  if (format === 'claude') return (json.content || []).some((item: any) => item.type === 'tool_use')
  return (json.candidates || []).some((c: any) => (c.content?.parts || []).some((part: any) => part.functionCall))
}

export function modelNamesFromJson(json: any) {
  const names = new Set<string>()
  const add = (value: unknown) => { if (value) names.add(canonicalModelName(String(value))) }
  if (Array.isArray(json)) json.forEach((item) => add(item.id || item.name))
  ;(json?.data || []).forEach((item: any) => add(item.id || item.name))
  ;(json?.models || []).forEach((item: any) => add(item.name || item.id))
  return names
}

function firstText(values: unknown[]) {
  return values.find((item) => typeof item === 'string' && item.length) as string || ''
}
