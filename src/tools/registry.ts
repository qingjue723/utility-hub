import { BracketsCurly, Code, Fingerprint, Hash, Key, LinkSimple, ListChecks, LockKey, MapPin, Password } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { ComponentType } from 'react'

export type ToolDefinition = {
  id: string
  category: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  keywords: string[]
  icon: Icon
  load: () => Promise<{ default: ComponentType }>
}

export const tools: ToolDefinition[] = [
  {
    id: 'password-generator',
    category: 'Security',
    name: { zh: '密码生成器', en: 'Password Generator' },
    description: { zh: '生成密码、密码短语、用户名和 Gmail 邮箱别名。', en: 'Generate passwords, passphrases, usernames, and Gmail aliases.' },
    keywords: ['password', 'passphrase', 'username', 'security', 'gmail', 'alias', 'email alias', 'dot trick', 'plus address', '密码', '密码短语', '用户名', '邮箱别名', 'Gmail别名'],
    icon: Key,
    load: () => import('./security/PasswordTool').then((module) => ({ default: module.PasswordTool })),
  },
  {
    id: 'list-tools',
    category: 'Text',
    name: { zh: '列表去重 / 重复项', en: 'List Dedupe / Duplicates' },
    description: { zh: '提取唯一项、重复项，并保留原始顺序。', en: 'Extract unique and duplicated lines while preserving order.' },
    keywords: ['list', 'dedupe', 'duplicates', '文本', '去重'],
    icon: ListChecks,
    load: () => import('./text/ListTool').then((module) => ({ default: module.ListTool })),
  },
  {
    id: 'totp-2fa',
    category: 'Security',
    name: { zh: '2FA 验证码', en: '2FA / TOTP' },
    description: { zh: '生成 TOTP 密钥、二维码和当前验证码。', en: 'Generate TOTP secrets, QR codes, and current tokens.' },
    keywords: ['2fa', 'totp', 'otp', 'authenticator'],
    icon: Password,
    load: () => import('./security/TotpTool').then((module) => ({ default: module.TotpTool })),
  },
  {
    id: 'address-generator',
    category: 'Generate',
    name: { zh: '真实地址资料生成器', en: 'Real US Address Profile' },
    description: { zh: '生成真实美国地址和合成注册资料，每项可复制。', en: 'Generate real US address rows with synthetic registration profile fields.' },
    keywords: ['address', 'profile', 'registration', 'us address', '地址', '真实地址', '注册资料'],
    icon: MapPin,
    load: () => import('./generate/AddressTool').then((module) => ({ default: module.AddressTool })),
  },
  {
    id: 'aes-crypto',
    category: 'Crypto',
    name: { zh: 'AES 加密 / 解密', en: 'AES Encrypt / Decrypt' },
    description: { zh: '使用浏览器加密能力处理 AES-GCM 加密和解密。', en: 'Use AES-GCM and PBKDF2 through Web Crypto.' },
    keywords: ['aes', 'encrypt', 'decrypt', 'crypto', '加密', '解密'],
    icon: LockKey,
    load: () => import('./security/CryptoTool').then((module) => ({ default: module.CryptoTool })),
  },
  {
    id: 'base64',
    category: 'Encoding',
    name: { zh: 'Base64 编码', en: 'Base64 Encoder' },
    description: { zh: '支持 Unicode 文本的 Base64 编码和解码。', en: 'Encode and decode Base64 with Unicode text support.' },
    keywords: ['base64', 'encode', 'decode', '编码'],
    icon: BracketsCurly,
    load: () => import('./text/Base64Tool').then((module) => ({ default: module.Base64Tool })),
  },
  {
    id: 'url-codec',
    category: 'Encoding',
    name: { zh: 'URL 编码', en: 'URL Encoder' },
    description: { zh: '快速处理 URL 编码和解码。', en: 'Encode and decode URL strings quickly.' },
    keywords: ['url', 'encode', 'decode', 'uri'],
    icon: LinkSimple,
    load: () => import('./text/UrlTool').then((module) => ({ default: module.UrlTool })),
  },
  {
    id: 'json-format',
    category: 'Data',
    name: { zh: 'JSON 格式化', en: 'JSON Formatter' },
    description: { zh: '格式化、压缩并校验 JSON。', en: 'Format, minify, and validate JSON.' },
    keywords: ['json', 'format', 'minify'],
    icon: Fingerprint,
    load: () => import('./text/JsonTool').then((module) => ({ default: module.JsonTool })),
  },
  {
    id: 'hash-generator',
    category: 'Crypto',
    name: { zh: '哈希生成器', en: 'Hash Generator' },
    description: { zh: '生成 SHA-1、SHA-256、SHA-512 摘要。', en: 'Generate SHA-1, SHA-256, and SHA-512 digests.' },
    keywords: ['hash', 'sha', 'digest', '摘要'],
    icon: Hash,
    load: () => import('./text/HashTool').then((module) => ({ default: module.HashTool })),
  },
  {
    id: 'html-preview',
    category: 'Web',
    name: { zh: 'HTML 预览', en: 'HTML Preview' },
    description: { zh: '用隔离预览窗口查看 HTML 片段。', en: 'Preview HTML snippets inside a sandboxed iframe.' },
    keywords: ['html', 'preview', 'iframe', 'web'],
    icon: Code,
    load: () => import('./web/HtmlPreviewTool').then((module) => ({ default: module.HtmlPreviewTool })),
  },
]

export function getTool(id?: string) {
  return tools.find((tool) => tool.id === id)
}
