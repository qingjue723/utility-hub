import { useMemo } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { linesOf } from '../../lib/text'

type ListToolState = {
  input: string
  mode: 'unique' | 'duplicates'
}

export function ListTool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<ListToolState>('utility-hub-tool-state:list-tools', () => ({ input: t.sampleList, mode: 'unique' }))

  const output = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    const orderedDuplicates: string[] = []
    const unique: string[] = []
    for (const line of linesOf(state.input)) {
      if (seen.has(line)) {
        if (!duplicates.has(line)) orderedDuplicates.push(line)
        duplicates.add(line)
      } else {
        unique.push(line)
        seen.add(line)
      }
    }
    return (state.mode === 'unique' ? unique : orderedDuplicates).join('\n')
  }, [state.input, state.mode])

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<button className="text-button" type="button" onClick={resetState}>{t.restoreDefaults}</button>}><textarea value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} /></Panel>
      <Panel title={t.output} actions={<div className="inline-segmented"><button className={state.mode === 'unique' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'unique' }))}>{t.unique}</button><button className={state.mode === 'duplicates' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'duplicates' }))}>{t.duplicates}</button></div>}>
        <textarea className="output-area" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
