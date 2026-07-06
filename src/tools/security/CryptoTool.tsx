import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { base64ToBytes, bytesToBase64 } from '../../lib/bytes'

type CryptoToolState = {
  mode: 'encrypt' | 'decrypt'
  password: string
  input: string
}

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
  const [state, setState, resetState] = usePersistentState<CryptoToolState>('utility-hub-tool-state:aes-crypto', () => ({ mode: 'encrypt', password: '', input: t.sampleProtectedText }))
  const [output, setOutput] = useState('')
  const canRun = useMemo(() => state.password.length >= 8 && state.input.length > 0, [state.password, state.input])

  function resetTool() {
    resetState()
    setOutput('')
  }

  async function run() {
    try {
      if (state.mode === 'encrypt') {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await deriveKey(state.password, salt)
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoder.encode(state.input)))
        setOutput(JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: 310000, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(encrypted) }, null, 2))
      } else {
        const payload = JSON.parse(state.input) as { salt: string; iv: string; data: string }
        const key = await deriveKey(state.password, base64ToBytes(payload.salt))
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(payload.iv)) }, key, toArrayBuffer(base64ToBytes(payload.data)))
        setOutput(decoder.decode(decrypted))
      }
    } catch {
      setOutput(t.cryptoFailed)
    }
  }

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<><div className="inline-segmented"><button className={state.mode === 'encrypt' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'encrypt' }))}>{t.encrypt}</button><button className={state.mode === 'decrypt' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'decrypt' }))}>{t.decrypt}</button></div><button className="text-button" type="button" onClick={resetTool}>{t.restoreDefaults}</button></>}>
        <input className="text-input" type="password" placeholder={t.passwordMin} value={state.password} onChange={(event) => setState((current) => ({ ...current, password: event.target.value }))} />
        <textarea className="mono" value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} />
        <button className="button primary" disabled={!canRun} onClick={run}>{t.run}</button>
      </Panel>
      <Panel title={t.output}><textarea className="output-area mono" readOnly value={output} /><div className="action-row"><CopyButton value={output} /></div></Panel>
    </div>
  )
}
