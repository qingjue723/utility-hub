import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'

export function UrlTool() {
  const { t } = useLocale()
  const [input, setInput] = useState('https://example.com/search?q=utility hub&lang=zh')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const output = useMemo(() => {
    try { return mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input) } catch { return t.invalidUrl }
  }, [input, mode, t.invalidUrl])
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
