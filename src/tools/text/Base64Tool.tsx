import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { base64Decode, base64Encode } from '../../lib/text'

type Base64ToolState = {
  input: string
  mode: 'encode' | 'decode'
}

export function Base64Tool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<Base64ToolState>('utility-hub-tool-state:base64', () => ({ input: t.sampleBase64, mode: 'encode' }))
  const output = useMemo(() => {
    try { return state.mode === 'encode' ? base64Encode(state.input) : base64Decode(state.input) } catch { return t.invalidBase64 }
  }, [state.input, state.mode, t.invalidBase64])
  return <CodecPanel state={state} setState={setState} resetState={resetState} output={output} />
}

function CodecPanel({ state, setState, resetState, output }: { state: Base64ToolState; setState: Dispatch<SetStateAction<Base64ToolState>>; resetState: () => void; output: string }) {
  const { t } = useLocale()
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
