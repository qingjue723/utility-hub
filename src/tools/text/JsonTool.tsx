import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'

export function JsonTool() {
  const { t } = useLocale()
  const [input, setInput] = useState(t.sampleJson)
  const [compact, setCompact] = useState(false)
  const output = useMemo(() => {
    try { return JSON.stringify(JSON.parse(input), null, compact ? 0 : 2) } catch { return t.invalidJson }
  }, [input, compact, t.invalidJson])
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input}><textarea className="mono" value={input} onChange={(event) => setInput(event.target.value)} /></Panel>
      <Panel title={t.output} actions={<label className="inline-check"><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /> {t.minify}</label>}>
        <textarea className="output-area mono" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
