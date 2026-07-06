import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { base64Decode, base64Encode } from '../../lib/text'

export function Base64Tool() {
  const { t } = useLocale()
  const [input, setInput] = useState(t.sampleBase64)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const output = useMemo(() => {
    try { return mode === 'encode' ? base64Encode(input) : base64Decode(input) } catch { return t.invalidBase64 }
  }, [input, mode, t.invalidBase64])
  return <CodecPanel input={input} setInput={setInput} mode={mode} setMode={setMode} output={output} />
}

function CodecPanel({ input, setInput, mode, setMode, output }: { input: string; setInput: (v: string) => void; mode: string; setMode: (v: any) => void; output: string }) {
  const { t } = useLocale()
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input}><textarea value={input} onChange={(event) => setInput(event.target.value)} /></Panel>
      <Panel title={t.output} actions={<div className="inline-segmented"><button className={mode === 'encode' ? 'active' : ''} onClick={() => setMode('encode')}>{t.encode}</button><button className={mode === 'decode' ? 'active' : ''} onClick={() => setMode('decode')}>{t.decode}</button></div>}>
        <textarea className="output-area" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
