import { Route, Routes } from 'react-router'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'
import { ToolPage } from './ToolPage'
import { LocaleProvider } from './providers/LocaleProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { FavoritesProvider } from './FavoritesContext'

export function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <FavoritesProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="tools/:toolId" element={<ToolPage />} />
            </Route>
          </Routes>
        </FavoritesProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
