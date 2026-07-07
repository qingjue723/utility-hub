import { DEFAULT_MODES, FORMAT_META, TEXT_TOKEN_LIMIT, TOOL_TOKEN_LIMIT } from './apiFormatConstants'
import { requestBody } from './apiFormatCore'
import { getRequestCacheKey } from './apiFormatRequest'
import type { ApiFormat, ApiFormatConfig, ApiMode } from './apiFormatTypes'

const OUTPUT_LIMIT_BY_MODE: Record<ApiMode, number> = { tool: TOOL_TOKEN_LIMIT, text: TEXT_TOKEN_LIMIT, stream: TEXT_TOKEN_LIMIT }

export function estimateRunUsage(cfg: ApiFormatConfig) {
  const formats = selectedEstimateFormats(cfg)
  const modes = cfg.modes.length ? cfg.modes : DEFAULT_MODES
  const modelListRequests = countModelListRequests(cfg, formats)
  const generationRequests = formats.length * modes.length
  const outputTokenLimit = formats.length * generationOutputLimit(modes)
  const inputChars = formats.reduce((total, format) => total + modes.reduce((sum, mode) => sum + JSON.stringify(requestBody(format, cfg, mode)).length, 0), 0)
  return { formats, modelListRequests, generationRequests, totalRequests: modelListRequests + generationRequests, outputTokenLimit, inputTokenEstimate: estimateInputTokens(inputChars) }
}

function selectedEstimateFormats(cfg: ApiFormatConfig) {
  const supported = new Set(Object.keys(FORMAT_META))
  return [...new Set(cfg.formats)].filter((format): format is ApiFormat => supported.has(format))
}

function countModelListRequests(cfg: ApiFormatConfig, formats: ApiFormat[]) {
  const keys = new Set<string>()
  for (const format of formats) keys.add(getRequestCacheKey(format, cfg, { method: 'GET', path: FORMAT_META[format].modelPath }))
  return keys.size
}

function generationOutputLimit(modes: ApiMode[]) {
  return modes.reduce((total, mode) => total + (OUTPUT_LIMIT_BY_MODE[mode] || 0), 0)
}

function estimateInputTokens(chars: number) {
  if (chars <= 0) return { min: 0, max: 0, chars: 0 }
  return { min: Math.ceil(chars / 4), max: Math.ceil(chars / 3), chars }
}
