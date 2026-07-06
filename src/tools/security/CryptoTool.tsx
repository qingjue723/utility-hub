import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { base64ToBytes, bytesToBase64 } from '../../lib/bytes'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

async function deriveKey(password: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 310000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function CryptoTool() {
  const { t } = useLocale()
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [password, setPassword] = useState('')
  const [input, setInput] = useState(t.sampleProtectedText)
  const [output, setOutput] = useState('')
  const canRun = useMemo(() => password.length >= 8 && input.length > 0, [password, input])

  async function run() {
    try {
      if (mode === 'encrypt') {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await deriveKey(password, salt)
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoder.encode(input)))
        setOutput(JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: 310000, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(encrypted) }, null, 2))
      } else {
        const payload = JSON.parse(input) as { salt: string; iv: string; data: string }
        const key = await deriveKey(password, base64ToBytes(payload.salt))
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(payload.iv)) }, key, toArrayBuffer(base64ToBytes(payload.data)))
        setOutput(decoder.decode(decrypted))
      }
    } catch {
      setOutput(t.cryptoFailed)
    }
  }

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<div className="inline-segmented"><button className={mode === 'encrypt' ? 'active' : ''} onClick={() => setMode('encrypt')}>{t.encrypt}</button><button className={mode === 'decrypt' ? 'active' : ''} onClick={() => setMode('decrypt')}>{t.decrypt}</button></div>}>
        <input className="text-input" type="password" placeholder={t.passwordMin} value={password} onChange={(event) => setPassword(event.target.value)} />
        <textarea className="mono" value={input} onChange={(event) => setInput(event.target.value)} />
        <button className="button primary" disabled={!canRun} onClick={run}>{t.run}</button>
      </Panel>
      <Panel title={t.output}><textarea className="output-area mono" readOnly value={output} /><div className="action-row"><CopyButton value={output} /></div></Panel>
    </div>
  )
}
