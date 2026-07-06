import { Moon, Sparkle, Star, Sun, Translate } from '@phosphor-icons/react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useLocale } from './providers/LocaleProvider'
import { useTheme } from './providers/ThemeProvider'

export function AppLayout() {
  const { locale, setLocale, t } = useLocale()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const favoritesOnly = searchParams.get('favorites') === '1'
  const switchLocaleLabel = locale === 'zh-CN' ? '切换为英文' : 'Switch to Chinese'
  const favoriteFilterLabel = locale === 'zh-CN'
    ? favoritesOnly ? '显示全部工具' : '只显示星标工具'
    : favoritesOnly ? 'Show all tools' : 'Show starred tools'

  function toggleFavoriteFilter() {
    navigate(favoritesOnly ? '/' : '/?favorites=1')
  }

  return (
    <div className="app-shell">
      <div className="grain" />
      <header className="nav-shell" aria-label={t.primaryNavigation}>
        <div className="nav-inner">
          <Link className="brand-mark" to="/" aria-label={t.homeLabel}>
            <span className="brand-glyph"><Sparkle size={16} weight="fill" /></span>
            <span className="brand-copy">
              <span className="brand-name">{t.appName}</span>
            </span>
          </Link>
          <div className="nav-actions">
            <button className={favoritesOnly ? 'nav-button active' : 'nav-button'} type="button" onClick={toggleFavoriteFilter} aria-label={favoriteFilterLabel} aria-pressed={favoritesOnly}>
              <Star size={16} weight={favoritesOnly ? 'fill' : 'regular'} />
            </button>
            <button className="nav-button" type="button" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')} aria-label={switchLocaleLabel}>
              <Translate size={16} />
            </button>
            <button className="nav-button" type="button" onClick={toggleTheme} aria-label={t.themeToggle}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
