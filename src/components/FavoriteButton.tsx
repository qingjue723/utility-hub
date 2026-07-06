import { Star } from '@phosphor-icons/react'
import { useFavorites } from '../app/FavoritesContext'
import { useLocale } from '../app/providers/LocaleProvider'

export function FavoriteButton({ toolId }: { toolId: string }) {
  const favorites = useFavorites()
  const { t } = useLocale()
  const active = favorites.items.includes(toolId)
  return (
    <button className={active ? 'favorite-button active' : 'favorite-button'} type="button" onClick={() => favorites.toggle(toolId)} aria-label={t.toggleFavorite}>
      <Star size={18} weight={active ? 'fill' : 'regular'} />
    </button>
  )
}
