import { useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { linesOf } from '../../lib/text'

export function ListTool() {
  const { t } = useLocale()
  const [input, setInput] = useState(t.sampleList)
  const [mode, setMode] = useState<'unique' | 'duplicates'>('unique')

  const output = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    const orderedDuplicates: string[] = []
    const unique: string[] = []
    for (const line of linesOf(input)) {
      if (seen.has(line)) {
        if (!duplicates.has(line)) orderedDuplicates.push(line)
        duplicates.add(line)
      } else {
        unique.push(line)
        seen.add(line)
      }
    }
    return (mode === 'unique' ? unique : orderedDuplicates).join('\n')
  }, [input, mode])

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input}><textarea value={input} onChange={(event) => setInput(event.target.value)} /></Panel>
      <Panel title={t.output} actions={<div className="inline-segmented"><button className={mode === 'unique' ? 'active' : ''} onClick={() => setMode('unique')}>{t.unique}</button><button className={mode === 'duplicates' ? 'active' : ''} onClick={() => setMode('duplicates')}>{t.duplicates}</button></div>}>
        <textarea className="output-area" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
