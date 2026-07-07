import { MagnifyingGlass } from '@phosphor-icons/react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useFavorites } from './FavoritesContext'
import { useLocale } from './providers/LocaleProvider'
import { ToolCard } from '../components/ToolCard'
import { tools } from '../tools/registry'

const categoryLabelKeys = {
  Security: 'categorySecurity',
  Crypto: 'categoryCrypto',
  Text: 'categoryText',
  Encoding: 'categoryEncoding',
  Data: 'categoryData',
  Finance: 'categoryFinance',
  Generate: 'categoryGenerate',
  Web: 'categoryWeb',
  API: 'categoryApi',
} as const

export function HomePage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [searchParams] = useSearchParams()
  const favorites = useFavorites()
  const { locale, t } = useLocale()
  const favoritesOnly = searchParams.get('favorites') === '1'

  const filteredTools = useMemo(() => {
    const sourceTools = favoritesOnly ? tools.filter((tool) => favorites.items.includes(tool.id)) : tools
    const value = deferredQuery.trim().toLowerCase()
    if (!value) return sourceTools
    return sourceTools.filter((tool) =>
      [tool.name.zh, tool.name.en, tool.description.zh, tool.description.en, tool.category, ...tool.keywords].some((item) =>
        item.toLowerCase().includes(value),
      ),
    )
  }, [deferredQuery, favorites.items, favoritesOnly])

  const groupedTools = useMemo(() => {
    return filteredTools.reduce<Record<string, typeof tools>>((groups, tool) => {
      groups[tool.category] = [...(groups[tool.category] ?? []), tool]
      return groups
    }, {})
  }, [filteredTools])

  const sortedGroups = useMemo(() => {
    return Object.entries(groupedTools).sort(([categoryA, toolsA], [categoryB, toolsB]) => {
      if (toolsA.length !== toolsB.length) return toolsB.length - toolsA.length
      const labelA = t[categoryLabelKeys[categoryA as keyof typeof categoryLabelKeys]] ?? categoryA
      const labelB = t[categoryLabelKeys[categoryB as keyof typeof categoryLabelKeys]] ?? categoryB
      return labelA.localeCompare(labelB, locale)
    })
  }, [groupedTools, locale, t])

  return (
    <main className="page home-page">
      <section className="home-search reveal">
        <label className="search-box" aria-label={t.searchLabel}>
          <MagnifyingGlass size={19} />
          <input id="tool-search" name="tool-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
        </label>
      </section>

      <section className="tools-section reveal" id="tools">
        {sortedGroups.map(([category, categoryTools]) => (
          <div className="tool-group" key={category}>
            <div className="group-heading">
              <span className="group-label">{t[categoryLabelKeys[category as keyof typeof categoryLabelKeys]] ?? category}</span>
              <span>{categoryTools.length}</span>
            </div>
            <div className="tool-grid">
              {categoryTools.map((tool, index) => <ToolCard key={tool.id} tool={tool} index={index} />)}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
