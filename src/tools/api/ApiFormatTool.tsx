import { ArrowCounterClockwise, CaretDown, CaretRight, Eye, EyeSlash, ListMagnifyingGlass, Play, Stop, Trash } from '@phosphor-icons/react'
import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { API_FORMATS, API_MODES, DEFAULT_EXPECTED_TEXT, DEFAULT_MODES, FORMAT_META, WAIT_TICK_MS } from './apiFormatConstants'
import { getFormatPath, requestBody } from './apiFormatCore'
import { apiRequest, getDisplayUrl, getRequestCacheKey, isAbortError } from './apiFormatRequest'
import { applyFlags, convertModelList, convertResponse, convertStream, createEmptyFormatResult, getFailedModes, getFailedResults, modelListReason, replaceResult, resultSummary, stepAdvice, stepErrorText } from './apiFormatResults'
import { estimateRunUsage } from './apiFormatUsage'
import type { ActiveStepState, ApiFormat, ApiFormatConfig, ApiFormatResult, ApiLogEvent, ApiMode, ApiStep, ApiStepResult, LogLevel, SavedApiFormatConfig } from './apiFormatTypes'

const STORAGE_KEY = 'utility-hub-tool-state:api-format-tester'

type ModelOption = { modelName: string; label: string }
type LogFilters = { level: LogLevel | 'all'; format: ApiFormat | 'all'; step: ApiStep | 'all'; search: string; failedOnly: boolean }

const DEFAULT_STATE: SavedApiFormatConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: '',
  model: 'gpt-4o-mini',
  delaySeconds: 2,
  formats: ['chat', 'responses', 'claude', 'gemini'],
  modes: DEFAULT_MODES,
}

export function ApiFormatTool() {
  const { t } = useLocale()
  const [state, setState, resetStoredState] = usePersistentState<SavedApiFormatConfig>(STORAGE_KEY, () => DEFAULT_STATE)
  const [showSecret, setShowSecret] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runState, setRunState] = useState(t.apiFormatNoResults)
  const [results, setResults] = useState<ApiFormatResult[]>([])
  const [logs, setLogs] = useState<ApiLogEvent[]>([])
  const [activeSteps, setActiveSteps] = useState<Map<string, ActiveStepState>>(() => new Map())
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [filters, setFilters] = useState<LogFilters>({ level: 'all', format: 'all', step: 'all', search: '', failedOnly: false })
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const [notice, setNotice] = useState('')
  const [completionNotice, setCompletionNotice] = useState<{ total: number; success: number; fail: number; skip: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logSequenceRef = useRef(0)
  const modelCacheRef = useRef(new Map<string, ApiStepResult>())
  const modelPromisesRef = useRef(new Map<string, Promise<ApiStepResult>>())
  const lastConfigRef = useRef<ApiFormatConfig | null>(null)

  const cfg = useMemo<ApiFormatConfig>(() => ({ ...state, baseUrl: state.baseUrl.trim().replace(/\/+$/, ''), model: state.model.trim(), delaySeconds: Math.max(0, Number(state.delaySeconds || 0)), expectedText: DEFAULT_EXPECTED_TEXT }), [state])
  const usage = useMemo(() => estimateRunUsage(cfg), [cfg])
  const failedResults = useMemo(() => getFailedResults(results, cfg.modes), [results, cfg.modes])
  const filteredLogs = useMemo(() => filterLogs(logs, filters), [logs, filters])

  function patchState(patch: Partial<SavedApiFormatConfig>) {
    setState((current) => ({ ...current, ...patch }))
  }

  function toggleFormat(format: ApiFormat, checked: boolean) {
    setState((current) => ({ ...current, formats: checked ? [...new Set([...current.formats, format])] : current.formats.filter((item) => item !== format) }))
  }

  function toggleMode(mode: ApiMode, checked: boolean) {
    setState((current) => ({ ...current, modes: checked ? [...new Set([...current.modes, mode])] : current.modes.filter((item) => item !== mode) }))
  }

  function log(input: { level?: LogLevel; format?: ApiFormat; step?: ApiStep; status?: number | ''; durationMs?: number | null; message: string }) {
    const now = new Date()
    const event: ApiLogEvent = {
      id: String(++logSequenceRef.current),
      timestamp: now.getTime(),
      time: now.toLocaleTimeString(),
      level: input.level ?? classifyLogLevel(input.message),
      format: input.format,
      step: input.step,
      status: input.status ?? '',
      durationMs: input.durationMs ?? null,
      message: input.message,
    }
    setLogs((current) => [...current, event])
  }

  function setStepState(format: ApiFormat, step: ApiStep, value: ActiveStepState | null) {
    setActiveSteps((current) => {
      const next = new Map(current)
      const key = `${format}:${step}`
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  function clearAllStepStates() {
    setActiveSteps(new Map())
  }

  function validateConfig(config: ApiFormatConfig) {
    if (!config.baseUrl) return setNotice(t.apiFormatValidationBaseUrl), false
    if (!config.model) return setNotice(t.apiFormatValidationModel), false
    if (!config.formats.length) return setNotice(t.apiFormatValidationChooseFormat), false
    if (!config.modes.length) return setNotice(t.apiFormatValidationChooseMode), false
    setNotice('')
    return true
  }

  async function pullModels() {
    if (!cfg.baseUrl || !cfg.formats.length) {
      setNotice(!cfg.baseUrl ? t.apiFormatValidationBaseUrl : t.apiFormatValidationChooseFormat)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setIsRunning(true)
    setRunState(t.apiFormatPullingModels)
    log({ message: t.apiFormatLogPullList })
    try {
      const pulled = await Promise.allSettled(cfg.formats.map(async (format) => ({ format, result: await testModelList(format, cfg, controller.signal) })))
      const fulfilled = pulled.flatMap((entry, index) => {
        if (entry.status === 'fulfilled') return [entry.value]
        log({ level: 'error', format: cfg.formats[index], step: 'models', message: t.apiFormatLogPullFailed.replace('{message}', entry.reason?.message || String(entry.reason)) })
        return []
      })
      const { options, skipped } = buildModelOptions(fulfilled)
      skipped.forEach((message) => log({ level: 'warn', message }))
      setModelOptions(options)
      setRunState(options.length ? t.apiFormatModelsPulled : t.apiFormatNotFound)
      log({ level: options.length ? 'success' : 'warn', message: options.length ? t.apiFormatLogFoundModels.replace('{count}', String(options.length)) : t.apiFormatNotFound })
    } catch (error) {
      if (isAbortError(error)) log({ level: 'warn', message: t.apiFormatLogPullStopped })
      else log({ level: 'error', message: t.apiFormatLogPullFailed.replace('{message}', error instanceof Error ? error.message : String(error)) })
      setRunState(isAbortError(error) ? t.apiFormatStopped : t.apiFormatPullFailed)
    } finally {
      abortRef.current = null
      setIsRunning(false)
    }
  }

  async function runTests() {
    if (!validateConfig(cfg)) return
    const controller = new AbortController()
    abortRef.current = controller
    lastConfigRef.current = cfg
    let nextResults: ApiFormatResult[] = []
    setResults([])
    setOpenDetails(new Set())
    clearAllStepStates()
    setIsRunning(true)
    setRunState(t.apiFormatTesting)
    setNotice('')
    setCompletionNotice(null)
    try {
      for (const format of cfg.formats) {
        const result = await testFormatCapabilities(format, cfg, controller.signal, undefined, (updated) => {
          nextResults = replaceResult(nextResults, updated)
          setResults(nextResults)
        })
        nextResults = replaceResult(nextResults, result)
        setResults(nextResults)
        if (result.authFailed) log({ level: 'error', message: t.apiFormatLogAuthFailedContinue })
      }
      clearAllStepStates()
      setRunState(t.apiFormatComplete)
      setCompletionNotice(buildCompletionNotice(nextResults))
    } catch (error) {
      clearAllStepStates()
      if (isAbortError(error)) {
        setRunState(t.apiFormatStopped)
        setNotice(t.apiFormatStopped)
        setCompletionNotice(null)
      } else {
        setRunState(t.apiFormatNotComplete)
        log({ level: 'error', message: t.apiFormatLogTestFailed.replace('{message}', error instanceof Error ? error.message : String(error)) })
      }
    } finally {
      abortRef.current = null
      setIsRunning(false)
    }
  }

  async function retryFailed() {
    const failed = getFailedResults(results, cfg.modes)
    if (!failed.length) return
    const base = lastConfigRef.current ?? cfg
    const retryCfg: ApiFormatConfig = { ...base, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl || base.baseUrl, model: cfg.model || base.model, delaySeconds: cfg.delaySeconds, formats: failed.map((item) => item.format), modes: cfg.modes.length ? cfg.modes : base.modes }
    if (!validateConfig(retryCfg)) return
    const controller = new AbortController()
    abortRef.current = controller
    setIsRunning(true)
    setRunState(t.apiFormatRetrying)
    setCompletionNotice(null)
    log({ message: t.apiFormatLogRetry.replace('{formats}', failed.map((item) => FORMAT_META[item.format].name).join(', ')) })
    let nextResults = [...results]
    try {
      for (const item of failed) {
        const failedModes = getFailedModes(item, retryCfg.modes)
        const scopedCfg = { ...retryCfg, modes: failedModes }
        const result = await testFormatCapabilities(item.format, scopedCfg, controller.signal, item, (updated) => {
          nextResults = replaceResult(nextResults, updated)
          setResults(nextResults)
        })
        nextResults = replaceResult(nextResults, result)
        setResults(nextResults)
        if (result.authFailed) log({ level: 'error', message: t.apiFormatLogAuthFailedContinue })
      }
      clearAllStepStates()
      setRunState(t.apiFormatRetryComplete)
      setCompletionNotice(buildCompletionNotice(nextResults))
    } catch (error) {
      clearAllStepStates()
      setRunState(isAbortError(error) ? t.apiFormatStopped : t.apiFormatNotComplete)
      if (!isAbortError(error)) log({ level: 'error', message: t.apiFormatLogTestFailed.replace('{message}', error instanceof Error ? error.message : String(error)) })
    } finally {
      abortRef.current = null
      setIsRunning(false)
    }
  }

  function stopRun() {
    abortRef.current?.abort()
  }

  function clearPage() {
    abortRef.current?.abort()
    resetStoredState()
    setResults([])
    setLogs([])
    setModelOptions([])
    setNotice(t.apiFormatReset)
    setCompletionNotice(null)
    setRunState(t.apiFormatNoResults)
    clearAllStepStates()
    modelCacheRef.current.clear()
    modelPromisesRef.current.clear()
  }

  function openDetail(format: ApiFormat, step: ApiStep) {
    const key = `${format}:${step}`
    setOpenDetails((current) => new Set(current).add(key))
    window.setTimeout(() => document.getElementById(detailElementId(format, step))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function toggleDetail(key: string) {
    setOpenDetails((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function testModelList(format: ApiFormat, config: ApiFormatConfig, signal: AbortSignal) {
    const path = FORMAT_META[format].modelPath
    const cacheKey = getRequestCacheKey(format, config, { method: 'GET', path })
    const cached = modelCacheRef.current.get(cacheKey)
    if (cached) {
      log({ level: 'info', format, step: 'models', message: t.apiFormatLogReuseModels.replace('{format}', FORMAT_META[format].name).replace('{url}', getDisplayUrl(format, config, path)) })
      return cached
    }
    const inflight = modelPromisesRef.current.get(cacheKey)
    if (inflight) return inflight
    const promise = (async () => {
      log({ level: 'info', format, step: 'models', message: t.apiFormatLogFetchModels.replace('{format}', FORMAT_META[format].name).replace('{url}', getDisplayUrl(format, config, path)) })
      setStepState(format, 'models', { state: 'running' })
      const response = await apiRequest(format, config, { method: 'GET', path }, signal)
      const result = convertModelList(response, config)
      modelCacheRef.current.set(cacheKey, result)
      modelPromisesRef.current.delete(cacheKey)
      log({ level: result.listOk && (!result.model || result.modelFound) ? 'success' : 'error', format, step: 'models', status: result.status, durationMs: result.durationMs, message: t.apiFormatLogModelResult.replace('{format}', FORMAT_META[format].name).replace('{mark}', modelListReason(result, t)).replace('{reason}', modelListReason(result, t)) })
      setStepState(format, 'models', null)
      return result
    })()
    modelPromisesRef.current.set(cacheKey, promise)
    return promise
  }

  async function testMode(format: ApiFormat, config: ApiFormatConfig, mode: ApiMode, signal: AbortSignal, requestCountRef: { current: number }) {
    const path = getFormatPath(format, config.model, mode)
    log({ level: 'info', format, step: mode, message: t.apiFormatLogTestMode.replace('{format}', FORMAT_META[format].name).replace('{mode}', stepLabel(mode)).replace('{url}', getDisplayUrl(format, config, path)) })
    if (requestCountRef.current > 0 && config.delaySeconds > 0) await waitBeforeRequest(format, mode, config.delaySeconds, signal)
    requestCountRef.current += 1
    setStepState(format, mode, { state: 'running' })
    const response = await apiRequest(format, config, { method: 'POST', path, body: requestBody(format, config, mode) }, signal)
    const result = mode === 'stream' ? convertStream(response, format, config, t) : convertResponse(response, format, mode, config)
    log({ level: resultLogLevel(result, mode), format, step: mode, status: result.status, durationMs: result.durationMs, message: t.apiFormatLogModeResult.replace('{format}', FORMAT_META[format].name).replace('{mode}', stepLabel(mode)).replace('{summary}', resultSummary(result, mode, t)) })
    setStepState(format, mode, null)
    return result
  }

  async function testFormatCapabilities(format: ApiFormat, config: ApiFormatConfig, signal: AbortSignal, existingResult?: ApiFormatResult, onUpdate?: (result: ApiFormatResult) => void) {
    const result = existingResult ? { ...existingResult } : createEmptyFormatResult(format, config)
    const modes = config.modes.length ? config.modes : DEFAULT_MODES
    const requestCountRef = { current: 0 }
    onUpdate?.({ ...result })

    const modelOk = existingResult?.modelList?.listOk && existingResult?.modelList?.modelFound
    if (!modelOk) result.modelList = await testModelList(format, config, signal)
    onUpdate?.(applyFlags({ ...result }))

    for (const mode of modes) {
      result[mode] = await testMode(format, config, mode, signal, requestCountRef)
      onUpdate?.(applyFlags({ ...result }))
    }
    return applyFlags(result)
  }

  async function waitBeforeRequest(format: ApiFormat, step: ApiStep, delaySeconds: number, signal: AbortSignal) {
    const totalMs = Math.max(0, delaySeconds * 1000)
    const startedAt = performance.now()
    while (true) {
      if (signal.aborted) throw signal.reason
      const remainingMs = totalMs - (performance.now() - startedAt)
      if (remainingMs <= 0) break
      const seconds = (Math.ceil(Math.max(0, remainingMs) / WAIT_TICK_MS) * WAIT_TICK_MS) / 1000
      setStepState(format, step, { state: 'waiting', message: t.apiFormatWaitSeconds.replace('{seconds}', Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)) })
      await wait(Math.min(WAIT_TICK_MS, remainingMs), signal)
    }
  }

  function buildCompletionNotice(items: ApiFormatResult[]) {
    const counts = countResultStats(items, cfg.modes)
    const total = counts.success + counts.fail + counts.skip
    return { total, success: counts.success, fail: counts.fail, skip: counts.skip }
  }

  return (
    <div className="tool-workspace api-format-workspace">
      <Panel title={t.apiFormatConnectionInfo} actions={<button className="text-button" type="button" onClick={clearPage}>{t.apiFormatClearPage}</button>}>
        <div className="api-format-notice">{t.apiFormatBrowserDirect}</div>
        {notice && <p className="error-text">{notice}</p>}
        <div className="api-format-config-section">
        <div className="api-format-config-grid">
          <label className="field"><span>{t.apiFormatBaseUrl}</span><input className="text-input" type="url" value={state.baseUrl} onChange={(event) => patchState({ baseUrl: event.target.value })} placeholder="https://api.example.com" /></label>
          <label className="field"><span>{t.apiFormatApiKey}</span><span className="api-format-secret-field"><input className="text-input" type={showSecret ? 'text' : 'password'} value={state.apiKey} onChange={(event) => patchState({ apiKey: event.target.value })} placeholder="••••••••••••••••" /><button className="text-button" type="button" onClick={() => setShowSecret((value) => !value)} aria-label={t.apiFormatToggleVisibility}>{showSecret ? <EyeSlash size={18} /> : <Eye size={18} />}</button></span></label>
          <label className="field"><span>{t.apiFormatModel}</span><input className="text-input" value={state.model} onChange={(event) => patchState({ model: event.target.value })} placeholder="gpt-4o-mini" /></label>
          <label className="field"><span>{t.apiFormatModelSelect}</span><span className="api-format-model-row"><select value="" disabled={!modelOptions.length} onChange={(event) => event.target.value && patchState({ model: event.target.value })}><option value="">{modelOptions.length ? t.apiFormatSelect : t.apiFormatNotFound}</option>{modelOptions.map((item) => <option key={item.label} value={item.modelName}>{item.label}</option>)}</select><button className="button secondary" type="button" onClick={pullModels} disabled={isRunning}><ListMagnifyingGlass size={16} />{t.apiFormatPullModels}</button></span></label>
        </div>
        </div>
        <div className="api-format-capability-section">
          <div className="api-format-options">
            <div><div className="api-format-option-title">{t.apiFormatFormats}</div>{API_FORMATS.map((format) => <label className="check-row" key={format}><input type="checkbox" checked={state.formats.includes(format)} onChange={(event) => toggleFormat(format, event.target.checked)} />{FORMAT_META[format].label}</label>)}</div>
            <div><div className="api-format-option-title">{t.apiFormatModes}</div>{API_MODES.map((mode) => <label className="check-row" key={mode}><input type="checkbox" checked={state.modes.includes(mode)} onChange={(event) => toggleMode(mode, event.target.checked)} />{stepLabel(mode)}</label>)}</div>
            <label className="field api-format-delay"><span>{t.apiFormatDelay}: {state.delaySeconds.toFixed(1)}s</span><input type="range" min="0" max="10" step="0.5" value={state.delaySeconds} onChange={(event) => patchState({ delaySeconds: Number(event.target.value) })} /></label>
          </div>
        </div>
        <div className="api-format-actions">
          <button className="button primary" type="button" onClick={runTests} disabled={isRunning}><Play size={16} />{isRunning ? t.apiFormatRunningButton.replace('{state}', runState) : t.apiFormatStartTest}</button>
          <button className="button secondary" type="button" onClick={stopRun} disabled={!isRunning}><Stop size={16} />{t.apiFormatStop}</button>
          <button className="button secondary" type="button" onClick={retryFailed} disabled={isRunning || !failedResults.length}><ArrowCounterClockwise size={16} />{failedResults.length ? t.apiFormatRetryFailed : t.apiFormatRetryUnavailable}</button>
          <button className="button secondary" type="button" onClick={clearPage}><Trash size={16} />{t.clear}</button>
        </div>
        <div className="api-format-usage"><span>{runState}</span><span>{t.apiFormatMaxCalls.replace('{count}', String(usage.totalRequests))}</span><span>{usage.inputTokenEstimate.max ? t.apiFormatTokenEstimate.replace('{min}', String(usage.inputTokenEstimate.min)).replace('{max}', String(usage.inputTokenEstimate.max + usage.outputTokenLimit)) : t.apiFormatTokenEstimateZero}</span></div>
      </Panel>

      <Panel title={t.apiFormatSummaryTitle} actions={completionNotice && <div className="api-format-summary-status">{runState} · {completionNotice.success} {t.apiFormatAvailable} · {completionNotice.fail} {t.apiFormatUnavailable} · {completionNotice.skip} {t.apiFormatUntested}</div>}>
        <div className="api-format-summary-grid">{API_FORMATS.map((format) => <SummaryCard key={format} format={format} result={results.find((item) => item.format === format)} active={state.formats.includes(format)} activeSteps={activeSteps} modes={cfg.modes} onOpen={(step) => openDetail(format, step)} />)}</div>
      </Panel>

      <Panel title={t.apiFormatLogsTitle} actions={<button className="text-button" type="button" onClick={() => setLogs([])}>{t.apiFormatClearLogs}</button>}>
        <LogFiltersView filters={filters} setFilters={setFilters} />
        <div className="api-format-log-list">{filteredLogs.length ? filteredLogs.map((event) => <LogRow key={event.id} event={event} />) : <p className="subtle-line">{logs.length ? t.apiFormatNoMatchLogs : t.apiFormatEmptyLogs}</p>}</div>
      </Panel>

      <Panel title={t.apiFormatDetailsTitle} actions={<><button className="text-button" type="button" onClick={() => setOpenDetails(new Set(results.flatMap((item) => detailSteps(item, cfg.modes).map((step) => `${item.format}:${step}`))))}>{t.apiFormatExpandAll}</button><button className="text-button" type="button" onClick={() => setOpenDetails(new Set())}>{t.apiFormatCollapseAll}</button></>}>
        <div className="api-format-details">{results.length ? results.map((item) => <FormatDetails key={item.format} item={item} modes={cfg.modes} openDetails={openDetails} />) : <p className="subtle-line">{t.apiFormatEmptyDetails}</p>}</div>
      </Panel>
    </div>
  )

  function stepLabel(step: ApiStep) {
    if (step === 'models') return t.apiFormatStepModels
    if (step === 'text') return t.apiFormatStepText
    if (step === 'stream') return t.apiFormatStepStream
    return t.apiFormatStepTool
  }

  function SummaryCard({ format, result, active, activeSteps: activeStepMap, modes, onOpen }: { format: ApiFormat; result?: ApiFormatResult; active: boolean; activeSteps: Map<string, ActiveStepState>; modes: ApiMode[]; onOpen: (step: ApiStep) => void }) {
    const steps = ['models', ...(modes.length ? modes : DEFAULT_MODES)] as ApiStep[]
    const counts = countSummary(result, steps)
    const activity = activeFormatState(activeStepMap, format)
    const tone = activity?.state ?? (counts.fail ? 'fail' : counts.success ? 'success' : 'skip')
    return <article className="api-format-card" data-tone={tone} data-muted={!active}>
      <button className="api-format-format-cell" type="button" onClick={() => onOpen('models')}>
        <strong>{FORMAT_META[format].name}</strong>
        <span>{activity?.message || summaryLabel(counts, active)}</span>
      </button>
      <div className="api-format-step-grid">{steps.map((step) => {
        const state = activeStepMap.get(`${format}:${step}`)?.state ?? stepState(result, step)
        const label = activeStepMap.get(`${format}:${step}`)?.message || stepStateLabel(state)
        return <button className="api-format-step" data-state={state} type="button" key={step} onClick={() => onOpen(step)}><span>{stepLabel(step)}</span><strong>{label}</strong></button>
      })}</div>
    </article>
  }

  function LogFiltersView({ filters, setFilters }: { filters: LogFilters; setFilters: React.Dispatch<React.SetStateAction<LogFilters>> }) {
    return <div className="api-format-log-filters">
      <select value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as LogFilters['level'] }))}><option value="all">{t.apiFormatAllStatus}</option><option value="info">{t.apiFormatLogInfo}</option><option value="success">{t.apiFormatLogSuccess}</option><option value="warn">{t.apiFormatLogWarn}</option><option value="error">{t.apiFormatLogError}</option></select>
      <select value={filters.format} onChange={(event) => setFilters((current) => ({ ...current, format: event.target.value as LogFilters['format'] }))}><option value="all">{t.apiFormatAllFormats}</option>{API_FORMATS.map((format) => <option key={format} value={format}>{FORMAT_META[format].name}</option>)}</select>
      <select value={filters.step} onChange={(event) => setFilters((current) => ({ ...current, step: event.target.value as LogFilters['step'] }))}><option value="all">{t.apiFormatAllSteps}</option><option value="models">{t.apiFormatStepModels}</option><option value="text">{t.apiFormatStepText}</option><option value="stream">{t.apiFormatStepStream}</option><option value="tool">{t.apiFormatStepTool}</option></select>
      <input className="text-input" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t.apiFormatSearchLogs} />
      <label className="inline-check"><input type="checkbox" checked={filters.failedOnly} onChange={(event) => setFilters((current) => ({ ...current, failedOnly: event.target.checked }))} />{t.apiFormatFailedOnly}</label>
    </div>
  }

  function LogRow({ event }: { event: ApiLogEvent }) {
    return <div className="api-format-log-row" data-level={event.level}><span>{event.time}</span><strong>{levelLabel(event.level)}</strong><p>{event.format ? `${FORMAT_META[event.format].name} · ` : ''}{event.step ? `${stepLabel(event.step)} · ` : ''}{event.message}</p><small>{event.status ? `HTTP ${event.status}` : t.apiFormatNoResponse}{event.durationMs != null ? ` · ${event.durationMs}ms` : ''}</small></div>
  }

  function FormatDetails({ item, modes, openDetails }: { item: ApiFormatResult; modes: ApiMode[]; openDetails: Set<string> }) {
    return <section className="api-format-detail-group"><h3>{FORMAT_META[item.format].label}</h3>{detailSteps(item, modes).map((step) => {
      const key = `${item.format}:${step}`
      const result = step === 'models' ? item.modelList : item[step]
      const open = openDetails.has(key)
      return <div id={detailElementId(item.format, step)} className="api-format-detail-row" data-open={open} key={key}><button type="button" onClick={() => toggleDetail(key)}>{open ? <CaretDown size={14} /> : <CaretRight size={14} />}<span>{stepLabel(step)}</span><strong>{result ? stepStateLabel(stepState(item, step)) : t.apiFormatUntested}</strong></button>{open && <StepDetail result={result} step={step} />}</div>
    })}</section>
  }

  function StepDetail({ result, step }: { result?: ApiStepResult; step: ApiStep }) {
    const text = result ? detailCopyText(result, step) : ''
    return <div className="api-format-detail-body">
      <div className="api-format-detail-meta"><span>{t.apiFormatStatus}: {result ? (result.status || t.apiFormatNoHttpResponse) : t.apiFormatNoRequest}</span><span>{t.apiFormatDuration}: {result?.durationMs != null ? `${result.durationMs}ms` : t.apiFormatNone}</span><span>{t.apiFormatJudgement}: {stepErrorText(result, step, t)}</span></div>
      <p className="subtle-line">{stepAdvice(result, step, t)}</p>
      {result && <><CodeBlock title={t.apiFormatRequest} value={JSON.stringify(result.request, null, 2)} /><CodeBlock title={t.apiFormatResponseBody} value={result.responseBody || t.apiFormatEmptyValue} /><div className="action-row"><CopyButton value={text} label={t.apiFormatCopyDetails} /></div></>}
    </div>
  }

  function CodeBlock({ title, value }: { title: string; value: string }) {
    return <div className="api-format-code-block"><div><span>{title}</span><CopyButton value={value} /></div><pre>{value}</pre></div>
  }

  function levelLabel(level: LogLevel) {
    if (level === 'error') return t.apiFormatLogError
    if (level === 'warn') return t.apiFormatLogWarn
    if (level === 'success') return t.apiFormatLogSuccess
    return t.apiFormatLogInfo
  }

  function stepState(result: ApiFormatResult | undefined, step: ApiStep): 'success' | 'fail' | 'skip' {
    if (!result) return 'skip'
    const stepResult = step === 'models' ? result.modelList : result[step]
    if (!stepResult) return 'skip'
    return stepOk(stepResult, step) ? 'success' : 'fail'
  }

  function stepOk(result: ApiStepResult, step: ApiStep) {
    if (step === 'models') return Boolean(result.listOk && result.modelFound)
    if (step === 'tool') return result.toolOk
    return result.textOk
  }

  function stepStateLabel(state: string) {
    if (state === 'running') return t.apiFormatRunning
    if (state === 'waiting') return t.apiFormatWaiting
    if (state === 'success') return t.apiFormatAvailable
    if (state === 'fail') return t.apiFormatUnavailable
    return t.apiFormatUntested
  }

  function summaryLabel(counts: { success: number; fail: number; skip: number }, active: boolean) {
    if (!active) return t.apiFormatNotSelected
    if (counts.fail) return t.apiFormatUnavailable
    if (counts.success && counts.skip) return t.apiFormatPartialAvailable
    if (counts.success) return t.apiFormatAllAvailable
    return t.apiFormatPending
  }

}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms)
    const abort = () => {
      window.clearTimeout(timeout)
      reject(signal.reason || new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

function buildModelOptions(pulled: { format: ApiFormat; result: ApiStepResult }[]) {
  const groupedModels = new Map<string, Set<string>>()
  const skipped: string[] = []
  for (const { format, result } of pulled) {
    if (!result.listOk || !result.modelNames?.length) {
      skipped.push(`${FORMAT_META[format].name}: no models`)
      continue
    }
    for (const modelName of result.modelNames) {
      if (!groupedModels.has(modelName)) groupedModels.set(modelName, new Set())
      groupedModels.get(modelName)?.add(FORMAT_META[format].name)
    }
  }
  return { options: [...groupedModels.entries()].map(([modelName, labels]) => ({ modelName, label: `${modelName} (${[...labels].join(', ')})` })), skipped }
}

function resultLogLevel(result: ApiStepResult, mode: ApiMode): LogLevel {
  if (mode === 'tool') return result.toolOk ? 'success' : 'error'
  return result.textOk ? 'success' : 'error'
}

function classifyLogLevel(message: string): LogLevel {
  if (/失败|错误|Error|error|failed|failure|timeout|超时|不可用/i.test(message)) return 'error'
  if (/警告|提醒|warn|warning/i.test(message)) return 'warn'
  if (/成功|完成|可用|找到|success|complete|available|found/i.test(message)) return 'success'
  return 'info'
}

function filterLogs(events: ApiLogEvent[], filters: LogFilters) {
  const search = filters.search.trim().toLowerCase()
  return events.filter((event) => {
    if (filters.level !== 'all' && event.level !== filters.level) return false
    if (filters.format !== 'all' && event.format !== filters.format) return false
    if (filters.step !== 'all' && event.step !== filters.step) return false
    if (filters.failedOnly && event.level !== 'error') return false
    if (!search) return true
    return [event.message, event.level, event.format, event.step, event.status, event.durationMs].join(' ').toLowerCase().includes(search)
  })
}

function countResultStats(results: ApiFormatResult[], modes: ApiMode[]) {
  return results.reduce((counts, item) => {
    for (const step of detailSteps(item, modes)) {
      const result = step === 'models' ? item.modelList : item[step]
      if (!result) counts.skip += 1
      else if (step === 'models' ? result.listOk && result.modelFound : step === 'tool' ? result.toolOk : result.textOk) counts.success += 1
      else counts.fail += 1
    }
    return counts
  }, { success: 0, fail: 0, skip: 0 })
}

function countSummary(result: ApiFormatResult | undefined, steps: ApiStep[]) {
  return steps.reduce((counts, step) => {
    if (!result) counts.skip += 1
    else {
      const stepResult = step === 'models' ? result.modelList : result[step]
      if (!stepResult) counts.skip += 1
      else if (step === 'models' ? stepResult.listOk && stepResult.modelFound : step === 'tool' ? stepResult.toolOk : stepResult.textOk) counts.success += 1
      else counts.fail += 1
    }
    return counts
  }, { success: 0, fail: 0, skip: 0 })
}

function activeFormatState(activeSteps: Map<string, ActiveStepState>, format: ApiFormat) {
  let waiting: ActiveStepState | null = null
  for (const [key, value] of activeSteps) {
    if (!key.startsWith(`${format}:`)) continue
    if (value.state === 'running') return value
    if (value.state === 'waiting') waiting = value
  }
  return waiting
}

function detailSteps(_item: ApiFormatResult, modes: ApiMode[]) {
  return ['models', ...(modes.length ? modes : DEFAULT_MODES)] as ApiStep[]
}

function detailCopyText(result: ApiStepResult, step: ApiStep) {
  return [`Step: ${step}`, `Status: ${result.status}`, `Duration: ${result.durationMs}ms`, `URL: ${result.url}`, 'Request:', JSON.stringify(result.request, null, 2), 'Response:', result.responseBody].join('\n')
}

function detailElementId(format: ApiFormat, step: ApiStep) {
  return `api-format-detail-${format}-${step}`
}
