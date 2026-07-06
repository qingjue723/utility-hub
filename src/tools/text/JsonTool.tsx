import { useMemo } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'

type JsonToolState = {
  input: string
  compact: boolean
}

export function JsonTool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<JsonToolState>('utility-hub-tool-state:json-format', () => ({ input: t.sampleJson, compact: false }))
  const output = useMemo(() => {
    try { return JSON.stringify(JSON.parse(state.input), null, state.compact ? 0 : 2) } catch { return t.invalidJson }
  }, [state.input, state.compact, t.invalidJson])
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<button className="text-button" type="button" onClick={resetState}>{t.restoreDefaults}</button>}><textarea className="large-tool-area mono" value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} /></Panel>
      <Panel title={t.output} actions={<label className="inline-check"><input type="checkbox" checked={state.compact} onChange={(event) => setState((current) => ({ ...current, compact: event.target.checked }))} /> {t.minify}</label>}>
        <textarea className="output-area large-tool-area mono" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
