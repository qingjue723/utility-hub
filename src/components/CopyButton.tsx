import { Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'
import { useLocale } from '../app/providers/LocaleProvider'

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useLocale()

  async function copyValue() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button className="button secondary" type="button" onClick={copyValue} disabled={!value}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? t.copied : (label ?? t.copy)}
    </button>
  )
}
