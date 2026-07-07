import { DEFAULT_EXPECTED_TEXT, DEFAULT_MODES, FORMAT_META } from './apiFormatConstants'
import { getResponseText, hasToolCall, modelNamesFromJson } from './apiFormatCore'
import { parseJson, parseStreamText } from './apiFormatSse'
import type { ApiFormat, ApiFormatConfig, ApiFormatResult, ApiMode, ApiRawResponse, ApiStepResult, TFunction } from './apiFormatTypes'

export function formatLabel(format: ApiFormat) {
  return FORMAT_META[format].name
}

export function convertResponse(response: ApiRawResponse, format: ApiFormat, mode: ApiMode, cfg: ApiFormatConfig): ApiStepResult {
  const parsed = response.hasResponse ? parseJson(response.bodyText) : { ok: false as const, value: null, error: '' }
  const formatOk = response.httpOk && parsed.ok
  const text = parsed.ok ? getResponseText(format, parsed.value) : ''
  const toolOk = parsed.ok && hasToolCall(format, parsed.value)
  return {
    kind: mode,
    status: response.status,
    url: response.url,
    request: response.request,
    responseBody: response.bodyText,
    hasResponse: response.hasResponse,
    httpOk: response.httpOk,
    jsonOk: parsed.ok,
    formatOk,
    textOk: formatOk && text.includes(cfg.expectedText),
    toolOk: formatOk && toolOk,
    error: response.error || parsed.error || '',
    timeout: response.timeout,
    durationMs: response.durationMs,
  }
}

export function convertStream(response: ApiRawResponse, format: ApiFormat, cfg: ApiFormatConfig, t: TFunction): ApiStepResult {
  const parsed = response.hasResponse ? parseStreamText(format, response.bodyText, t) : { ok: false, text: '', error: '' }
  return {
    kind: 'stream',
    status: response.status,
    url: response.url,
    request: response.request,
    responseBody: response.bodyText,
    hasResponse: response.hasResponse,
    httpOk: response.httpOk,
    jsonOk: parsed.ok,
    formatOk: response.httpOk && parsed.ok,
    textOk: response.httpOk && parsed.text.includes(cfg.expectedText),
    toolOk: false,
    error: response.error || parsed.error || '',
    timeout: response.timeout,
    durationMs: response.durationMs,
  }
}

export function convertModelList(response: ApiRawResponse, cfg: ApiFormatConfig): ApiStepResult {
  const parsed = response.hasResponse ? parseJson(response.bodyText) : { ok: false as const, value: null, error: '' }
  const names = parsed.ok ? modelNamesFromJson(parsed.value) : new Set<string>()
  const listOk = response.httpOk && parsed.ok
  return {
    kind: 'models',
    status: response.status,
    url: response.url,
    request: response.request,
    responseBody: response.bodyText,
    hasResponse: response.hasResponse,
    httpOk: response.httpOk,
    jsonOk: parsed.ok,
    formatOk: listOk,
    textOk: false,
    toolOk: false,
    listOk,
    modelNames: [...names].sort((left, right) => left.localeCompare(right)),
    model: cfg.model,
    modelFound: Boolean(cfg.model) && listOk && names.has(String(cfg.model).replace(/^models\//, '')),
    error: response.error || parsed.error || '',
    timeout: response.timeout,
    durationMs: response.durationMs,
  }
}

export function createEmptyFormatResult(format: ApiFormat, cfg: ApiFormatConfig): ApiFormatResult {
  return { format, label: formatLabel(format), model: cfg.model, formatOk: false, textOk: false, streamOk: false, toolOk: false, authFailed: false }
}

export function applyFlags(result: ApiFormatResult) {
  const steps = [result.tool, result.text, result.stream].filter(Boolean) as ApiStepResult[]
  result.formatOk = steps.some((step) => step.formatOk)
  result.textOk = Boolean(result.text?.textOk)
  result.streamOk = Boolean(result.stream?.textOk)
  result.toolOk = Boolean(result.tool?.toolOk)
  result.authFailed = steps.some((step) => [401, 403].includes(step.status))
  return result
}

export function replaceResult(results: ApiFormatResult[], nextResult: ApiFormatResult) {
  const replaced = results.map((item) => (item.format === nextResult.format ? nextResult : item))
  return replaced.some((item) => item.format === nextResult.format) ? replaced : [...replaced, nextResult]
}

export function modelListReason(modelList: ApiStepResult | undefined, t: TFunction) {
  if (!modelList) return t.apiFormatUntested
  if (!modelList.listOk) return failureReason(modelList, t)
  if (modelList.model && modelList.modelFound) return t.apiFormatModelFound
  if (!modelList.model) return t.apiFormatViewable
  return t.apiFormatModelNotFound
}

export function failureReason(result: ApiStepResult | undefined | null, t: TFunction) {
  if (!result) return t.apiFormatUntested
  if (result.timeout) return result.error || t.apiFormatRequestTimeout
  if (!result.hasResponse) return result.error || t.apiFormatCors
  if ([401, 403].includes(result.status)) return t.apiFormatAuthFailed
  if ([404, 405].includes(result.status)) return t.apiFormatEndpointNotFound
  if ([400, 422].includes(result.status)) return t.apiFormatIncompatibleRequest
  if (!result.httpOk) return t.apiFormatHttpFailed
  if (!result.jsonOk) return t.apiFormatNonJson
  return t.apiFormatUnavailable
}

export function resultSummary(result: ApiStepResult, mode: ApiMode | 'models', t: TFunction) {
  if (!result.hasResponse) return failureReason(result, t)
  if (mode === 'models') return modelListReason(result, t)
  if (mode === 'tool' && result.toolOk) return t.apiFormatToolAvailable
  if (mode !== 'tool' && result.textOk) return t.apiFormatTextAvailable
  return t.apiFormatHttpReason.replace('{status}', String(result.status)).replace('{reason}', failureReason(result, t))
}

export function resultHasFailure(item: ApiFormatResult, modes: ApiMode[] = DEFAULT_MODES) {
  if (!item.modelList || !item.modelList.listOk || !item.modelList.modelFound) return true
  if (!item.formatOk) return true
  for (const mode of modes) {
    if (mode === 'tool' && !item.tool?.toolOk) return true
    if (mode !== 'tool' && !item[mode]?.textOk) return true
  }
  return false
}

export function getFailedResults(results: ApiFormatResult[], modes: ApiMode[]) {
  return results.filter((item) => resultHasFailure(item, modes.length ? modes : DEFAULT_MODES))
}

export function getFailedModes(item: ApiFormatResult, modes: ApiMode[]) {
  const activeModes = modes.length ? modes : DEFAULT_MODES
  const failed: ApiMode[] = []
  for (const mode of activeModes) {
    if (mode === 'tool' && !item.tool?.toolOk) failed.push(mode)
    if (mode !== 'tool' && !item[mode]?.textOk) failed.push(mode)
  }
  return failed
}

export function stepErrorText(result: ApiStepResult | undefined, mode: ApiMode | 'models', t: TFunction) {
  if (!result) return t.apiFormatNoRequest
  if (result.error) return result.error
  if (mode === 'models' && result.listOk && result.modelFound) return t.apiFormatAvailable
  if (mode === 'models' && result.listOk && !result.modelFound) return t.apiFormatModelAbsent
  if (mode === 'tool' && result.toolOk) return t.apiFormatAvailable
  if (mode === 'tool' && result.formatOk && !result.toolOk) return t.apiFormatMissingToolCall
  if ((mode === 'text' || mode === 'stream') && result.textOk) return t.apiFormatAvailable
  if ((mode === 'text' || mode === 'stream') && result.formatOk && !result.textOk) return t.apiFormatMissingFixedText.replace('{text}', DEFAULT_EXPECTED_TEXT)
  return failureReason(result, t)
}

export function stepAdvice(result: ApiStepResult | undefined, mode: ApiMode | 'models', t: TFunction) {
  if (!result) return t.apiFormatAdviceNoResult
  if (result.timeout) return t.apiFormatAdviceTimeout
  if (!result.hasResponse) return t.apiFormatAdviceNoResponse
  if ([401, 403].includes(result.status)) return t.apiFormatAdviceAuth
  if ([404, 405].includes(result.status)) return t.apiFormatAdvicePath
  if ([400, 422].includes(result.status)) return t.apiFormatAdviceIncompatible
  if (!result.httpOk) return t.apiFormatAdviceHttp
  if (!result.jsonOk) return t.apiFormatAdviceJson
  if (mode === 'models' && !result.modelFound) return t.apiFormatAdviceModelMissing
  if (mode === 'tool' && !result.toolOk) return t.apiFormatAdviceToolMissing
  if ((mode === 'text' || mode === 'stream') && !result.textOk) return t.apiFormatAdviceTextMissing
  return t.apiFormatAdviceAvailable
}
