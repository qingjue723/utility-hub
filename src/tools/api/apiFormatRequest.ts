import { REQUEST_TIMEOUT_MS } from './apiFormatConstants'
import { getAuthMode, getHeaders } from './apiFormatCore'
import { sanitizeHeaders, sanitizeSecret, sanitizeUrl } from './apiFormatSanitize'
import type { ApiFormat, ApiFormatConfig, ApiRawResponse } from './apiFormatTypes'

export function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

export function addQueryKey(url: string, cfg: ApiFormatConfig, authMode: string) {
  if (authMode !== 'query-key') return url
  const glue = url.includes('?') ? '&' : '?'
  return `${url}${glue}key=${encodeURIComponent(cfg.apiKey)}`
}

export function getRequestCacheKey(format: ApiFormat, cfg: ApiFormatConfig, options: { method: string; path: string }) {
  const authMode = getAuthMode(format)
  const url = addQueryKey(joinUrl(cfg.baseUrl, options.path), cfg, authMode)
  return `${options.method} ${authMode} ${url}`
}

export function getDisplayUrl(format: ApiFormat, cfg: ApiFormatConfig, path: string) {
  const authMode = getAuthMode(format)
  const url = addQueryKey(joinUrl(cfg.baseUrl, path), cfg, authMode)
  return sanitizeUrl(url, cfg.apiKey)
}

export async function apiRequest(
  format: ApiFormat,
  cfg: ApiFormatConfig,
  options: { method: string; path: string; body?: unknown },
  signal?: AbortSignal,
  settings: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<ApiRawResponse> {
  const timeoutMs = settings.timeoutMs ?? REQUEST_TIMEOUT_MS
  const fetcher = settings.fetcher ?? fetch
  const authMode = getAuthMode(format)
  const url = addQueryKey(joinUrl(cfg.baseUrl, options.path), cfg, authMode)
  const headers = getHeaders(format, cfg, Boolean(options.body))
  const bodyText = options.body ? JSON.stringify(options.body) : ''
  const request = buildSafeRequest(options.method, url, headers, bodyText, cfg)
  const startedAt = performance.now()

  try {
    const response = await fetchWithTimeout(fetcher, url, { method: options.method, headers, body: bodyText || undefined }, signal, timeoutMs)
    const responseBody = await response.text()
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
    const safeBody = sanitizeSecret(responseBody, cfg.apiKey)
    return { hasResponse: true, httpOk: response.ok, status: response.status, request, url: request.url, bodyText: safeBody, error: response.ok ? '' : safeBody, timeout: false, durationMs }
  } catch (error) {
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
    if (isAbortError(error)) throw error
    if (isTimeoutError(error)) return networkFailure(request, timeoutMessage(timeoutMs), true, durationMs)
    return networkFailure(request, error instanceof Error ? error.message : 'Network or CORS failure', false, durationMs)
  }
}

export function timeoutMessage(timeoutMs = REQUEST_TIMEOUT_MS) {
  return `Timeout: no HTTP response within ${Math.round(timeoutMs / 1000)} seconds.`
}

function buildSafeRequest(method: string, url: string, headers: Record<string, string>, bodyText: string, cfg: ApiFormatConfig) {
  return { method, url: sanitizeUrl(url, cfg.apiKey), headers: sanitizeHeaders(headers, cfg.apiKey), body: sanitizeSecret(bodyText, cfg.apiKey) }
}

function networkFailure(request: ApiRawResponse['request'], error: string, timeout: boolean, durationMs = 0): ApiRawResponse {
  return { hasResponse: false, httpOk: false, status: 0, request, url: request.url, bodyText: '', error, timeout, durationMs }
}

async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timeoutId: number | null = null
  let abortHandler: (() => void) | null = null
  try {
    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const error = makeTimeoutError(timeoutMs)
        controller.abort(error)
        reject(error)
      }, timeoutMs)
    })
    const abortPromise = new Promise<Response>((_, reject) => {
      if (!parentSignal) return
      abortHandler = () => {
        const error = parentSignal.reason || makeAbortError()
        controller.abort(error)
        reject(error)
      }
      if (parentSignal.aborted) abortHandler()
      else parentSignal.addEventListener('abort', abortHandler, { once: true })
    })
    return await Promise.race([fetcher(url, { ...init, signal: controller.signal }), timeoutPromise, abortPromise])
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
    if (abortHandler) parentSignal?.removeEventListener('abort', abortHandler)
  }
}

function makeTimeoutError(timeoutMs: number) {
  const error = new Error(timeoutMessage(timeoutMs))
  error.name = 'TimeoutError'
  return error
}

function makeAbortError() {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError'
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
