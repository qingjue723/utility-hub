import { Link } from 'react-router'
import { useLocale } from '../app/providers/LocaleProvider'
import type { ToolDefinition } from '../tools/registry'
import { FavoriteButton } from './FavoriteButton'

export function ToolCard({ tool }: { tool: ToolDefinition; index?: number }) {
  const { locale } = useLocale()
  const name = locale === 'zh-CN' ? tool.name.zh : tool.name.en

  return (
    <article className="tool-row">
      <Link className="tool-row-link" to={`/tools/${tool.id}`}>
        <span className="tool-row-name">{name}</span>
      </Link>
      <FavoriteButton toolId={tool.id} />
    </article>
  )
}
