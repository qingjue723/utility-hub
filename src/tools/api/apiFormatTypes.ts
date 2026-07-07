export type ApiFormat = 'chat' | 'responses' | 'claude' | 'gemini'

export type ApiMode = 'text' | 'stream' | 'tool'

export type ApiStep = 'models' | ApiMode

export type LogLevel = 'info' | 'success' | 'warn' | 'error'

export type ApiFormatConfig = {
  baseUrl: string
  apiKey: string
  model: string
  delaySeconds: number
  formats: ApiFormat[]
  modes: ApiMode[]
  expectedText: string
}

export type SavedApiFormatConfig = Omit<ApiFormatConfig, 'expectedText'>

export type SafeRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

export type ApiRawResponse = {
  hasResponse: boolean
  httpOk: boolean
  status: number
  request: SafeRequest
  url: string
  bodyText: string
  error: string
  timeout: boolean
  durationMs: number
}

export type ApiStepResult = {
  kind: ApiStep
  status: number
  url: string
  request: SafeRequest
  responseBody: string
  hasResponse: boolean
  httpOk: boolean
  jsonOk: boolean
  formatOk: boolean
  textOk: boolean
  toolOk: boolean
  listOk?: boolean
  modelNames?: string[]
  model?: string
  modelFound?: boolean
  error: string
  timeout: boolean
  durationMs: number
}

export type ApiFormatResult = {
  format: ApiFormat
  label: string
  model: string
  formatOk: boolean
  textOk: boolean
  streamOk: boolean
  toolOk: boolean
  authFailed: boolean
  modelList?: ApiStepResult
  text?: ApiStepResult
  stream?: ApiStepResult
  tool?: ApiStepResult
}

export type ApiLogEvent = {
  id: string
  timestamp: number
  time: string
  level: LogLevel
  format?: ApiFormat
  step?: ApiStep
  status?: number | ''
  durationMs?: number | null
  message: string
}

export type ActiveStepState = {
  state: 'running' | 'waiting'
  message?: string
}

export type FormatMeta = {
  label: string
  name: string
  path?: string
  modelPath: string
}

export type TFunction = Record<string, string>
