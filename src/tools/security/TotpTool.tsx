import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'

type TotpConfig = {
  issuer: string
  label: string
  secret: string
}

function normalizeBase32(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

function parseTotpInput(value: string, fallbackIssuer: string, fallbackLabel: string): TotpConfig | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    const url = new URL(trimmed)
    const secret = normalizeBase32(url.searchParams.get('secret') ?? '')
    const issuerFromQuery = url.searchParams.get('issuer') ?? ''
    const pathLabel = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const [issuerFromPath, labelFromPath] = pathLabel.includes(':') ? pathLabel.split(/:(.*)/).filter(Boolean) : ['', pathLabel]

    return {
      issuer: issuerFromQuery || issuerFromPath || fallbackIssuer,
      label: labelFromPath || pathLabel || fallbackLabel,
      secret,
    }
  }

  const secretFromQuery = trimmed.match(/(?:secret=)([A-Za-z2-7\s-]+)/i)?.[1]
  return {
    issuer: fallbackIssuer,
    label: fallbackLabel,
    secret: normalizeBase32(secretFromQuery ?? trimmed),
  }
}

function createTotp(config: TotpConfig) {
  return new OTPAuth.TOTP({
    issuer: config.issuer,
    label: config.label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: config.secret,
  })
}

export function TotpTool() {
  const { t } = useLocale()
  const [rawInput, setRawInput] = useState('JBSWY3DPEHPK3PXP')
  const [now, setNow] = useState(Date.now())
  const [qr, setQr] = useState('')

  const parsed = useMemo(() => {
    try {
      return parseTotpInput(rawInput, t.appName, 'temporary')
    } catch {
      return null
    }
  }, [rawInput, t.appName])

  const result = useMemo(() => {
    if (!parsed?.secret) return { token: '', uri: '', error: '' }
    try {
      const totp = createTotp(parsed)
      return { token: totp.generate(), uri: totp.toString(), error: '' }
    } catch {
      return { token: '', uri: '', error: t.totpInvalidSecret }
    }
  }, [parsed, t.totpInvalidSecret, now])

  const seconds = 30 - Math.floor((now / 1000) % 30)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!result.uri || result.error) {
      setQr('')
      return
    }
    QRCode.toDataURL(result.uri, { margin: 1, width: 220 })
      .then((nextQr) => {
        if (!cancelled) setQr(nextQr)
      })
      .catch(() => {
        if (!cancelled) setQr('')
      })
    return () => {
      cancelled = true
    }
  }, [result.uri, result.error])

  function regenerate() {
    const nextSecret = new OTPAuth.Secret({ size: 20 }).base32
    setRawInput(nextSecret)
  }

  return (
    <div className="tool-workspace two-col">
      <Panel title={t.secret}>
        <label className="field">
          <span>{t.totpInputLabel}</span>
          <textarea className="mono small" value={rawInput} onChange={(event) => setRawInput(event.target.value)} />
        </label>
        <button className="button secondary" type="button" onClick={regenerate}>{t.newSecret}</button>
      </Panel>
      <Panel title={t.code}>
        {result.error ? <p className="error-text">{result.error}</p> : <div className="totp-code">{result.token || '------'}</div>}
        <p className="subtle-line">{t.refreshesIn.replace('{seconds}', String(seconds))}</p>
        {qr && <img className="qr-code" src={qr} alt={t.qrCodeAlt} />}
        <div className="action-row"><CopyButton value={result.token} /></div>
      </Panel>
    </div>
  )
}
