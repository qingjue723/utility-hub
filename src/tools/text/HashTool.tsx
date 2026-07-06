import { useEffect, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { digestText } from '../../lib/text'

type HashToolState = {
  input: string
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512'
}

export function HashTool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<HashToolState>('utility-hub-tool-state:hash-generator', () => ({ input: t.sampleHash, algorithm: 'SHA-256' }))
  const [output, setOutput] = useState('')
  useEffect(() => { digestText(state.input, state.algorithm).then(setOutput) }, [state.input, state.algorithm])
  return (
    <div className="tool-workspace two-col">
      <Panel title={t.input} actions={<button className="text-button" type="button" onClick={resetState}>{t.restoreDefaults}</button>}><textarea value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} /></Panel>
      <Panel title={t.output}>
        <select value={state.algorithm} onChange={(event) => setState((current) => ({ ...current, algorithm: event.target.value as HashToolState['algorithm'] }))}><option>SHA-1</option><option>SHA-256</option><option>SHA-512</option></select>
        <textarea className="output-area mono" readOnly value={output} />
        <div className="action-row"><CopyButton value={output} /></div>
      </Panel>
    </div>
  )
}
