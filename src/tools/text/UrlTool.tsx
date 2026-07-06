import { useMemo } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'

type UrlToolState = {
  input: string
  mode: 'encode' | 'decode'
}

export function UrlTool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<UrlToolState>('utility-hub-tool-state:url-codec', () => ({ input: 'https://example.com/search?q=utility hub&lang=zh', mode: 'encode' }))
  const output = useMemo(() => {
    try { return state.mode === 'encode' ? encodeURIComponent(state.input) : decodeURIComponent(state.input) } catch { return t.invalidUrl }
  }, [state.input, state.mode, t.invalidUrl])
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<button className="text-button" type="button" onClick={resetState}>{t.restoreDefaults}</button>}><textarea value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} /></Panel>
      <Panel title={t.output} actions={<div className="inline-segmented"><button className={state.mode === 'encode' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'encode' }))}>{t.encode}</button><button className={state.mode === 'decode' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'decode' }))}>{t.decode}</button></div>}>
        <textarea className="output-area" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
