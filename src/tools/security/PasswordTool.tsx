import { useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import {
  defaultPassphraseOptions,
  defaultPasswordOptions,
  defaultUsernameOptions,
  entropyBits,
  generateGmailAliases,
  generatePassphrase,
  generatePassword,
  generateUsername,
  separatorFromKind,
  type GeneratedItem,
  type GeneratedResult,
  type GeneratorMode,
  type PassphraseOptions,
  type PasswordOptions,
  type SeparatorKind,
  type UsernameOptions,
  type UsernameKind,
  type WordListKind,
} from './generator'

type PasswordToolState = {
  mode: GeneratorMode
  passwordOptions: PasswordOptions
  passphraseOptions: PassphraseOptions
  separatorKind: SeparatorKind
  customSeparator: string
  usernameOptions: UsernameOptions
  resultCount: number
}

function defaultPasswordToolState(): PasswordToolState {
  return {
    mode: 'password',
    passwordOptions: defaultPasswordOptions,
    passphraseOptions: defaultPassphraseOptions,
    separatorKind: 'hyphen',
    customSeparator: '',
    usernameOptions: defaultUsernameOptions,
    resultCount: 10,
  }
}

export function PasswordTool() {
  const { t } = useLocale()
  const [state, setState, resetState] = usePersistentState<PasswordToolState>('utility-hub-tool-state:password-generator', defaultPasswordToolState)
  const [result, setResult] = useState<GeneratedResult>({ value: '' })

  function resetTool() {
    resetState()
    setResult({ value: '' })
  }

  function generate() {
    const count = Math.min(100, Math.max(1, Math.round(state.resultCount)))
    if (state.mode === 'username' && state.usernameOptions.type === 'gmailAlias') {
      setResult(generateGmailAliases(state.usernameOptions, count))
      return
    }

    const generator = state.mode === 'password'
      ? () => generatePassword(state.passwordOptions)
      : state.mode === 'passphrase'
        ? () => generatePassphrase(state.passphraseOptions)
        : () => generateUsername(state.usernameOptions)
    setResult(generateItems(generator, count))
  }

  function setPassword<K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) {
    setState((current) => ({ ...current, passwordOptions: { ...current.passwordOptions, [key]: value } }))
  }

  function setPassphrase<K extends keyof PassphraseOptions>(key: K, value: PassphraseOptions[K]) {
    setState((current) => ({ ...current, passphraseOptions: { ...current.passphraseOptions, [key]: value } }))
  }

  function setUsername<K extends keyof UsernameOptions>(key: K, value: UsernameOptions[K]) {
    setState((current) => ({ ...current, usernameOptions: { ...current.usernameOptions, [key]: value } }))
  }

  function updateSeparator(nextKind: SeparatorKind, nextCustom = state.customSeparator) {
    setState((current) => ({
      ...current,
      separatorKind: nextKind,
      customSeparator: nextCustom,
      passphraseOptions: { ...current.passphraseOptions, separator: separatorFromKind(nextKind, nextCustom) },
    }))
  }

  const entropy = entropyBits(state.passphraseOptions.wordList, state.passphraseOptions.wordCount).toFixed(0)
  const errorText = result.error ? t[result.error as keyof typeof t] : ''

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.settings} actions={(
        <>
          <div className="inline-segmented">
            <button className={state.mode === 'password' ? 'active' : ''} type="button" onClick={() => setState((current) => ({ ...current, mode: 'password' }))}>{t.generatorPassword}</button>
            <button className={state.mode === 'passphrase' ? 'active' : ''} type="button" onClick={() => setState((current) => ({ ...current, mode: 'passphrase' }))}>{t.generatorPassphrase}</button>
            <button className={state.mode === 'username' ? 'active' : ''} type="button" onClick={() => setState((current) => ({ ...current, mode: 'username' }))}>{t.generatorUsername}</button>
          </div>
          <button className="text-button" type="button" onClick={resetTool}>{t.restoreDefaults}</button>
        </>
      )}>

        <label className="field"><span>{t.count}</span><input type="range" min="1" max="100" value={state.resultCount} onChange={(event) => setState((current) => ({ ...current, resultCount: Number(event.target.value) }))} /><b>{state.resultCount}</b></label>

        {state.mode === 'password' && (
          <>
            <label className="field"><span>{t.length}</span><input type="range" min="5" max="128" value={state.passwordOptions.length} onChange={(event) => setPassword('length', Number(event.target.value))} /><b>{state.passwordOptions.length}</b></label>
            <div className="option-grid">
              <label className="check-row"><input type="checkbox" checked={state.passwordOptions.uppercase} onChange={(event) => setPassword('uppercase', event.target.checked)} /> {t.uppercase}</label>
              <label className="check-row"><input type="checkbox" checked={state.passwordOptions.lowercase} onChange={(event) => setPassword('lowercase', event.target.checked)} /> {t.lowercase}</label>
              <label className="check-row"><input type="checkbox" checked={state.passwordOptions.number} onChange={(event) => setPassword('number', event.target.checked)} /> {t.numbers}</label>
              <label className="check-row"><input type="checkbox" checked={state.passwordOptions.special} onChange={(event) => setPassword('special', event.target.checked)} /> {t.specialCharacters}</label>
            </div>
            <label className="check-row"><input type="checkbox" checked={!state.passwordOptions.ambiguous} onChange={(event) => setPassword('ambiguous', !event.target.checked)} /> {t.avoidAmbiguous}</label>
            <label className="field"><span>{t.minNumbers}</span><input type="range" min="0" max="9" value={state.passwordOptions.minNumber} onChange={(event) => setPassword('minNumber', Number(event.target.value))} /><b>{state.passwordOptions.minNumber}</b></label>
            <label className="field"><span>{t.minSpecial}</span><input type="range" min="0" max="9" value={state.passwordOptions.minSpecial} onChange={(event) => setPassword('minSpecial', Number(event.target.value))} /><b>{state.passwordOptions.minSpecial}</b></label>
          </>
        )}

        {state.mode === 'passphrase' && (
          <>
            <label className="field"><span>{t.wordList}</span><select value={state.passphraseOptions.wordList} onChange={(event) => setPassphrase('wordList', event.target.value as WordListKind)}><option value="english">{t.englishWordList}</option><option value="chinese">{t.chineseWordList}</option></select></label>
            <label className="field"><span>{t.wordCount}</span><input type="range" min="3" max="20" value={state.passphraseOptions.wordCount} onChange={(event) => setPassphrase('wordCount', Number(event.target.value))} /><b>{state.passphraseOptions.wordCount}</b></label>
            <label className="field"><span>{t.separator}</span><select value={state.separatorKind} onChange={(event) => updateSeparator(event.target.value as SeparatorKind)}><option value="hyphen">{t.separatorHyphen}</option><option value="space">{t.separatorSpace}</option><option value="period">{t.separatorPeriod}</option><option value="none">{t.separatorNone}</option><option value="custom">{t.separatorCustom}</option></select></label>
            {state.separatorKind === 'custom' && <input className="text-input" value={state.customSeparator} maxLength={1} placeholder={t.customSeparator} onChange={(event) => updateSeparator('custom', event.target.value)} />}
            <label className="check-row"><input type="checkbox" checked={state.passphraseOptions.capitalize} onChange={(event) => setPassphrase('capitalize', event.target.checked)} /> {t.capitalizeWords}</label>
            <label className="check-row"><input type="checkbox" checked={state.passphraseOptions.includeNumber} onChange={(event) => setPassphrase('includeNumber', event.target.checked)} /> {t.includeNumber}</label>
            <p className="subtle-line">{t.entropy}: {entropy} {t.bits}</p>
          </>
        )}

        {state.mode === 'username' && (
          <>
            <label className="field"><span>{t.usernameType}</span><select value={state.usernameOptions.type} onChange={(event) => setUsername('type', event.target.value as UsernameKind)}><option value="word">{t.usernameWord}</option><option value="random">{t.usernameRandom}</option><option value="gmailAlias">{t.usernameGmailAlias}</option><option value="catchall">{t.usernameCatchall}</option></select></label>
            {state.usernameOptions.type === 'word' && <label className="field"><span>{t.wordList}</span><select value={state.usernameOptions.wordList} onChange={(event) => setUsername('wordList', event.target.value as WordListKind)}><option value="english">{t.englishWordList}</option><option value="chinese">{t.chineseWordList}</option></select></label>}
            {state.usernameOptions.type === 'word' && <label className="check-row"><input type="checkbox" checked={state.usernameOptions.capitalize} onChange={(event) => setUsername('capitalize', event.target.checked)} /> {t.capitalizeWords}</label>}
            {state.usernameOptions.type === 'word' && <label className="check-row"><input type="checkbox" checked={state.usernameOptions.includeNumber} onChange={(event) => setUsername('includeNumber', event.target.checked)} /> {t.includeNumber}</label>}
            {state.usernameOptions.type === 'random' && <label className="field"><span>{t.randomLength}</span><input type="range" min="4" max="32" value={state.usernameOptions.randomLength} onChange={(event) => setUsername('randomLength', Number(event.target.value))} /><b>{state.usernameOptions.randomLength}</b></label>}
            {state.usernameOptions.type === 'catchall' && <input className="text-input" value={state.usernameOptions.domain} placeholder={t.domain} onChange={(event) => setUsername('domain', event.target.value)} />}
            {state.usernameOptions.type === 'gmailAlias' && (
              <>
                <input className="text-input" value={state.usernameOptions.gmailEmail} placeholder={t.gmailEmailAddress} onChange={(event) => setUsername('gmailEmail', event.target.value)} />
                <div className="option-grid">
                  <label className="check-row"><input type="checkbox" checked={state.usernameOptions.gmailUseDots} onChange={(event) => setUsername('gmailUseDots', event.target.checked)} /> {t.gmailDotAliases}</label>
                  <label className="check-row"><input type="checkbox" checked={state.usernameOptions.gmailUsePlus} onChange={(event) => setUsername('gmailUsePlus', event.target.checked)} /> {t.gmailPlusAliases}</label>
                  <label className="check-row"><input type="checkbox" checked={state.usernameOptions.gmailUseCase} onChange={(event) => setUsername('gmailUseCase', event.target.checked)} /> {t.gmailCaseAliases}</label>
                  <label className="check-row"><input type="checkbox" checked={state.usernameOptions.gmailUseGooglemail} onChange={(event) => setUsername('gmailUseGooglemail', event.target.checked)} /> {t.gmailGooglemailAliases}</label>
                </div>
                {state.usernameOptions.gmailUsePlus && <textarea className="small mono" value={state.usernameOptions.gmailPlusTags} placeholder={t.gmailPlusTagsPlaceholder} onChange={(event) => setUsername('gmailPlusTags', event.target.value)} />}
                <p className="subtle-line">{t.gmailAliasHint}</p>
              </>
            )}
          </>
        )}

        <button className="button primary" type="button" onClick={generate}>{t.generate}</button>
      </Panel>

      <Panel title={t.output}>
        {errorText && <p className="error-text">{errorText}</p>}
        {result.items?.length ? (
          <div className="result-list" aria-label={t.generatedResults}>
            {result.items.map((item, index) => (
              <ResultRow item={item} index={index} copyLabel={t.copy} copiedLabel={t.copied} key={`${item.value}-${index}`} />
            ))}
          </div>
        ) : (
          <textarea className="output-area mono" readOnly value={result.value} placeholder={t.clickGenerate} />
        )}
        {result.hint && <p className="subtle-line">{result.hint}</p>}
        <div className="action-row"><CopyButton value={result.value} label={result.items?.length ? t.copyAll : undefined} /></div>
      </Panel>
    </div>
  )
}

function generateItems(generator: () => GeneratedResult, count: number): GeneratedResult {
  const items: GeneratedItem[] = []
  const seen = new Set<string>()
  const maxAttempts = count * 3

  for (let attempt = 0; items.length < count && attempt < maxAttempts; attempt += 1) {
    const result = generator()
    if (result.error) return result
    if (!result.value || seen.has(result.value)) continue
    seen.add(result.value)
    items.push({ value: result.value, hint: result.hint })
  }

  return { value: items.map((item) => item.value).join('\n'), items }
}

function ResultRow({ item, index, copyLabel, copiedLabel }: { item: GeneratedItem; index: number; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    if (!item.value) return
    await navigator.clipboard.writeText(item.value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button className="result-row" type="button" onClick={copyValue} disabled={!item.value}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <strong>{item.value}</strong>
      {item.hint && <small>{item.hint}</small>}
      <em>{copied ? copiedLabel : copyLabel}</em>
    </button>
  )
}
