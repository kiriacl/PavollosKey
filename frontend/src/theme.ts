type Theme = 'light' | 'dark'

const key = 'pavollos.theme'
const eventName = 'pavollos:theme'
const system = window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): Theme | null {
  try {
    const value = localStorage.getItem(key)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

let preference = readPreference()

export const currentTheme = (): Theme => preference ?? (system.matches ? 'dark' : 'light')

function applyTheme() {
  const theme = currentTheme()
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c1119' : '#f4f6f9')
  window.dispatchEvent(new Event(eventName))
}

export function initializeTheme() {
  applyTheme()
  system.addEventListener('change', applyTheme)
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return
    preference = readPreference()
    applyTheme()
  })
}

export function changeTheme(theme: Theme) {
  preference = theme
  try {
    localStorage.setItem(key, theme)
  } catch {
    // A seleção continua disponível durante a sessão atual.
  }
  applyTheme()
}

export function subscribeToTheme(listener: () => void) {
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}
