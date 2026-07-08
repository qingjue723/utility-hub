import { Moon, Star, Sun, Translate } from '@phosphor-icons/react'
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
      <a className="skip-link" href="#main-content">{t.skipToContent}</a>
      <div className="grain" />
      <header className="nav-shell" aria-label={t.primaryNavigation}>
        <div className="nav-inner">
          <div className="brand-mark">
            <Link className="brand-home" to="/" aria-label={t.homeLabel}>
              <span className="brand-glyph" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
                  <rect width="64" height="64" rx="16" fill="var(--brand-glyph-canvas)" />
                  <rect x="8.5" y="8.5" width="47" height="47" rx="11.5" fill="var(--brand-glyph-surface)" stroke="var(--accent)" strokeOpacity="0.32" />
                  <rect x="14" y="17" width="36" height="30" rx="7" fill="var(--fg)" />
                  <path d="M20 17.5C20 15.567 21.567 14 23.5 14H40.5C42.433 14 44 15.567 44 17.5V20H40V18.75C40 18.336 39.664 18 39.25 18H24.75C24.336 18 24 18.336 24 18.75V20H20V17.5Z" fill="var(--accent)" />
                  <path d="M14 28H50" stroke="var(--brand-glyph-canvas)" strokeOpacity="0.82" strokeWidth="2" />
                  <path d="M32 25.5V30.5" stroke="var(--brand-glyph-warm)" strokeWidth="3" strokeLinecap="round" />
                  <path d="M22 37H42" stroke="var(--brand-glyph-warm)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M26 42H38" stroke="var(--brand-glyph-canvas)" strokeOpacity="0.68" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="48" cy="16" r="3" fill="var(--accent)" />
                </svg>
              </span>
              <span className="brand-name">{t.appName}</span>
            </Link>
            <a className="brand-author" href="https://blog.qjyg.de" target="_blank" rel="noreferrer">{t.authorName}</a>
          </div>
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
