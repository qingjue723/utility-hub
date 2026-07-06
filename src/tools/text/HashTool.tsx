import { useEffect, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { digestText } from '../../lib/text'

export function HashTool() {
  const { t } = useLocale()
  const [input, setInput] = useState(t.sampleHash)
  const [algorithm, setAlgorithm] = useState<'SHA-1' | 'SHA-256' | 'SHA-512'>('SHA-256')
  const [output, setOutput] = useState('')
  useEffect(() => { digestText(input, algorithm).then(setOutput) }, [input, algorithm])
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input}><textarea value={input} onChange={(event) => setInput(event.target.value)} /></Panel>
      <Panel title={t.output}>
        <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as typeof algorithm)}><option>SHA-1</option><option>SHA-256</option><option>SHA-512</option></select>
        <textarea className="output-area mono" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
