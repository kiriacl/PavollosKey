import { useSyncExternalStore } from 'react'
import { changeTheme, currentTheme, subscribeToTheme } from '../../theme'
import { Icon } from './Icon'

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme)
  const dark = theme === 'dark'
  const label = dark ? 'Ativar tema claro' : 'Ativar tema escuro'
  return (
    <button type="button" className="icon-button theme-toggle" aria-label={label} title={label}
      onClick={() => changeTheme(dark ? 'light' : 'dark')}>
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
