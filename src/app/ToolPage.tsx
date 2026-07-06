import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { Link, useParams } from 'react-router'
import { useRecents } from './FavoritesContext'
import { useLocale } from './providers/LocaleProvider'
import { ToolShell } from '../components/ToolShell'
import { ToolErrorBoundary } from '../components/ToolErrorBoundary'
import { getTool, tools } from '../tools/registry'

const lazyToolComponents = Object.fromEntries(
  tools.map((tool) => [tool.id, lazy(tool.load)]),
) as Record<string, LazyExoticComponent<ComponentType>>

export function ToolPage() {
  const { toolId } = useParams()
  const tool = getTool(toolId)
  const recents = useRecents()
  const { t } = useLocale()

  useEffect(() => {
    if (toolId) recents.add(toolId)
  }, [toolId])

  if (!tool) {
    return (
      <main className="page empty-page">
        <h1>{t.notFound}</h1>
        <Link className="button primary" to="/">{t.backHome}</Link>
      </main>
    )
  }

  const ToolComponent = lazyToolComponents[tool.id]
  return (
    <ToolShell tool={tool}>
      <ToolErrorBoundary resetKey={tool.id} message={t.toolCrashed} actionLabel={t.resetTool}>
        <Suspense fallback={<div className="tool-section">{t.loadingTool}</div>}>
          <ToolComponent />
        </Suspense>
      </ToolErrorBoundary>
    </ToolShell>
  )
}
