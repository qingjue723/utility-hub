import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowsClockwise, DotsSixVertical, Plus, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { currencies, defaultVisibleCurrencies, getCurrencyMeta, type CurrencyMeta } from './currencies'
import { fetchRates, type RatesResult } from './rates'

type CurrencyToolState = {
  visibleCodes: string[]
  activeCode: string
  activeAmount: string
}

const amountFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rateFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 })

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return ''
  return amountFormatter.format(value)
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return ''
  return rateFormatter.format(value)
}

function moveItem(items: string[], activeId: string, overId: string) {
  const oldIndex = items.indexOf(activeId)
  const newIndex = items.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0) return items
  return arrayMove(items, oldIndex, newIndex)
}

export function CurrencyTool() {
  const { locale, t } = useLocale()
  const [toolState, setToolState, resetToolState] = usePersistentState<CurrencyToolState>('utility-hub-tool-state:currency-converter', () => ({ visibleCodes: [...defaultVisibleCurrencies], activeCode: 'USD', activeAmount: '100' }))
  const [rates, setRates] = useState<RatesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function loadRates(base = toolState.activeCode) {
    setLoading(true)
    setError('')
    try {
      setRates(await fetchRates(base))
    } catch {
      setError(t.currencyFetchFailed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRates(toolState.activeCode)
  }, [toolState.activeCode])

  const visibleCurrencies = useMemo(() => toolState.visibleCodes.map((code) => getCurrencyMeta(code)).filter(Boolean) as CurrencyMeta[], [toolState.visibleCodes])
  const filteredCurrencies = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return currencies
    return currencies.filter((currency) =>
      [currency.code, currency.nameEn, currency.nameZh].some((item) => item.toLowerCase().includes(value)),
    )
  }, [query])

  const activeNumericAmount = parseAmount(toolState.activeAmount)
  const status = rates
    ? `${rates.cached ? t.currencyCachedRates : t.currencyLiveRates} · ${rates.provider} · ${rates.date}`
    : loading
      ? t.currencyLoadingRates
      : t.currencyWaitingRates

  function valueFor(code: string) {
    if (code === toolState.activeCode) return toolState.activeAmount
    const rate = rates?.rates[code]
    if (activeNumericAmount === null || !rate) return ''
    return formatAmount(activeNumericAmount * rate)
  }

  function rateFor(code: string) {
    if (code === toolState.activeCode) return t.currencyBaseRate
    const rate = rates?.rates[code]
    return rate ? `${t.currencyRate}: ${formatRate(rate)}` : t.currencyRateUnavailable
  }

  function updateAmount(code: string, value: string) {
    setToolState((current) => ({ ...current, activeCode: code, activeAmount: value }))
  }

  function toggleCurrency(code: string) {
    setToolState((current) => {
      if (current.visibleCodes.includes(code)) {
        if (current.visibleCodes.length === 1) return current
        const next = current.visibleCodes.filter((item) => item !== code)
        return { ...current, visibleCodes: next, activeCode: code === current.activeCode ? next[0] : current.activeCode }
      }
      return { ...current, visibleCodes: [...current.visibleCodes, code] }
    })
  }

  function removeCurrency(code: string) {
    setToolState((current) => {
      if (current.visibleCodes.length === 1) return current
      const next = current.visibleCodes.filter((item) => item !== code)
      return { ...current, visibleCodes: next, activeCode: code === current.activeCode ? next[0] : current.activeCode }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    setToolState((current) => ({ ...current, visibleCodes: moveItem(current.visibleCodes, String(event.active.id), String(event.over?.id)) }))
  }

  return (
    <div className="tool-workspace currency-workspace">
      <Panel
        title={t.currencyTitle}
        actions={
          <div className="currency-actions">
            <button className="button secondary" type="button" onClick={() => setEditing(true)}>
              <Plus size={16} />
              {t.currencyEditList}
            </button>
            <button className="text-button" type="button" onClick={resetToolState}>{t.restoreDefaults}</button>
            <button className="button secondary" type="button" onClick={() => void loadRates()} disabled={loading}>
              <ArrowsClockwise size={16} />
              {t.currencyRefresh}
            </button>
          </div>
        }
      >
        <p className="subtle-line">{t.currencyLocalNotice}</p>
        <div className="currency-status" data-error={Boolean(error)}>{error || status}</div>

        {editing && (
          <div className="currency-modal" role="dialog" aria-modal="true" aria-labelledby="currency-editor-title">
            <button className="currency-modal-backdrop" type="button" aria-label={t.currencyCloseEditor} onClick={() => setEditing(false)} />
            <div className="currency-editor">
              <div className="currency-editor-head">
                <div>
                  <h2 id="currency-editor-title">{t.currencyEditList}</h2>
                  <p>{t.currencyEditHint}</p>
                </div>
                <button className="text-button currency-editor-close" type="button" onClick={() => setEditing(false)} aria-label={t.currencyCloseEditor}>
                  <X size={18} />
                </button>
              </div>
              <label className="field">
                <span>{t.currencySearch}</span>
                <input className="text-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.currencySearchPlaceholder} />
              </label>
              <div className="currency-picker" aria-label={t.currencyEditList}>
                {filteredCurrencies.map((currency) => {
                  const checked = toolState.visibleCodes.includes(currency.code)
                  return (
                    <label className="currency-option" key={currency.code}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCurrency(currency.code)} />
                      <strong>{currency.code}</strong>
                      <span>{locale === 'zh-CN' ? currency.nameZh : currency.nameEn}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={toolState.visibleCodes} strategy={rectSortingStrategy}>
            <div className="currency-grid">
              {visibleCurrencies.map((currency) => (
                <CurrencyCard
                  key={currency.code}
                  currency={currency}
                  locale={locale}
                  active={currency.code === toolState.activeCode}
                  value={valueFor(currency.code)}
                  rate={rateFor(currency.code)}
                  removeLabel={t.currencyRemove}
                  onAmountChange={(value) => updateAmount(currency.code, value)}
                  onRemove={() => removeCurrency(currency.code)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </Panel>
    </div>
  )
}

function CurrencyCard({
  currency,
  locale,
  active,
  value,
  rate,
  removeLabel,
  onAmountChange,
  onRemove,
}: {
  currency: CurrencyMeta
  locale: string
  active: boolean
  value: string
  rate: string
  removeLabel: string
  onAmountChange: (value: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: currency.code })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <article className="currency-card" data-active={active} data-dragging={isDragging} ref={setNodeRef} style={style}>
      <button className="currency-drag" type="button" aria-label={currency.code} {...attributes} {...listeners}>
        <DotsSixVertical size={18} />
      </button>
      <div className="currency-card-main">
        <div className="currency-card-head">
          <div>
            <strong>{currency.code}</strong>
            <span>{locale === 'zh-CN' ? currency.nameZh : currency.nameEn}</span>
          </div>
          <em>{currency.symbol}</em>
        </div>
        <input className="text-input currency-input" inputMode="decimal" value={value} onChange={(event) => onAmountChange(event.target.value)} placeholder="0.00" />
        <small>{rate}</small>
      </div>
      <button className="text-button currency-remove" type="button" onClick={onRemove} aria-label={`${removeLabel} ${currency.code}`}>
        <X size={15} />
      </button>
    </article>
  )
}
