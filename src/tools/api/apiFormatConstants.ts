import type { ApiFormat, ApiMode, FormatMeta } from './apiFormatTypes'

export const DEFAULT_EXPECTED_TEXT = 'FORMAT_TEST_OK_SIGNAL'
export const REQUEST_TIMEOUT_MS = 30000
export const WAIT_TICK_MS = 100
export const TEXT_TOKEN_LIMIT = 256
export const TOOL_TOKEN_LIMIT = 128
export const DEFAULT_MODES: ApiMode[] = ['text', 'stream', 'tool']
export const API_FORMATS: ApiFormat[] = ['chat', 'responses', 'claude', 'gemini']
export const API_MODES: ApiMode[] = ['text', 'stream', 'tool']

export const FORMAT_META: Record<ApiFormat, FormatMeta> = {
  chat: { name: 'Chat', label: 'Chat Completions', modelPath: '/v1/models', path: '/v1/chat/completions' },
  responses: { name: 'Responses', label: 'Responses API', modelPath: '/v1/models', path: '/v1/responses' },
  claude: { name: 'Claude', label: 'Claude Messages', modelPath: '/v1/models', path: '/v1/messages' },
  gemini: { name: 'Gemini', label: 'Gemini GenerateContent', modelPath: '/v1beta/models' },
}
