// Device settings: theme and the analytics opt-out. Both live on this device.

export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'handoff:theme'
const ANALYTICS_KEY = 'handoff:analytics'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export function getTheme(): Theme {
  const t = read(THEME_KEY)
  return t === 'light' || t === 'dark' ? t : 'system'
}

// System follows the phone; Light and Dark override it via data-theme on <html>,
// which the color tokens already respect. index.html applies this before first paint.
export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'system') delete root.dataset.theme
  else root.dataset.theme = t
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#121A15' : '#F8F8F1'))
}

export function setTheme(t: Theme) {
  write(THEME_KEY, t === 'system' ? null : t)
  applyTheme(t)
}

// Browsers with Global Privacy Control turned on start with analytics off,
// unless the student switches it back on in Account settings.
function gpcOn() {
  return typeof navigator !== 'undefined' && (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

export function analyticsAllowed() {
  const v = read(ANALYTICS_KEY)
  if (v === 'off') return false
  if (v === 'on') return true
  return !gpcOn()
}

export function setAnalyticsAllowed(on: boolean) {
  write(ANALYTICS_KEY, on ? (gpcOn() ? 'on' : null) : 'off')
}
