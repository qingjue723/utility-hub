import { createContext, useContext } from 'react'
import { usePersistentList } from '../hooks/usePersistentList'

const FavoritesContext = createContext<ReturnType<typeof usePersistentList> | null>(null)
const RecentsContext = createContext<ReturnType<typeof usePersistentList> | null>(null)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const favorites = usePersistentList('utility-hub-favorites')
  const recents = usePersistentList('utility-hub-recents')
  return (
    <FavoritesContext.Provider value={favorites}>
      <RecentsContext.Provider value={recents}>{children}</RecentsContext.Provider>
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider')
  return context
}

export function useRecents() {
  const context = useContext(RecentsContext)
  if (!context) throw new Error('useRecents must be used within FavoritesProvider')
  return context
}
