import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePanelContext } from '../../hooks/usePanelContext'
import { panelGroups, panelModules, workActions } from '../../routes/panelNavigation'
import { modules, panelHref } from '../../routes/routes'
import { type Profile, roleLabels } from '../../services/auth'
import { apiErrorMessage } from '../../services/http'
import type { ModuleId } from '../../types/panel'
import { Brand } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { StatusLabel } from '../ui/StatusLabel'
import { ThemeToggle } from '../ui/ThemeToggle'
import { CommandPalette } from './CommandPalette'
import { MobileMenu } from './MobileMenu'
import './panel-layout.css'

function PanelNavigation({ current, available }: { current?: ModuleId; available: readonly ModuleId[] }) {
  return (
    <nav className="panel-nav" aria-label="Módulos do painel">
      <a href={panelHref()} aria-current={!current ? 'page' : undefined} title="Central de operações">
        <Icon name="grid" /><span>Central de operações</span>
      </a>
      {panelGroups.map(({ title, ids }) => {
        const visible = ids.filter((id) => available.includes(id))
        return visible.length > 0 && (
          <div className="panel-nav-group" key={title}>
            <p className="nav-heading">{title}</p>
            {visible.map((id) => (
              <a href={panelHref(id)} key={id} aria-current={current === id ? 'page' : undefined} title={modules[id].title}>
                <Icon name={modules[id].icon} /><span>{modules[id].title}</span>
              </a>
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function HomeLink() {
  return <a className="home-link" href="#inicio" title="Voltar ao início"><Icon name="home" size={18} /><span>Voltar ao início</span></a>
}

function MobileActions({ current, technical }: { current?: ModuleId; technical: boolean }) {
  const links: { id?: ModuleId; title: string }[] = [
    { title: 'Painel' },
    ...(technical ? [] : [{ id: 'solicitacoes' as const, title: 'Chamados' }, { id: 'clientes' as const, title: 'Clientes' }]),
    { id: 'servicos', title: 'Serviços' },
    ...(technical ? [{ id: 'historico' as const, title: 'Histórico' }] : []),
  ]
  return (
    <nav className="mobile-workbar" aria-label="Atalhos do celular">
      {links.map(({ id, title }) => (
        <a key={title} href={panelHref(id)} aria-current={id === current ? 'page' : undefined}>
          <Icon name={id ? modules[id].icon : 'grid'} size={19} /><span>{title}</span>
        </a>
      ))}
    </nav>
  )
}

function ProfileMenu({ profile, pending, onSignOut }: { profile: Profile; pending: boolean; onSignOut: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const initials = profile.nome.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')
  return (
    <details className="panel-profile" ref={menu} onKeyDown={(event) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false
        menu.current.querySelector('summary')?.focus()
      }
    }}>
      <summary aria-label={`Menu de perfil de ${profile.nome}`}>
        <span className="panel-avatar" aria-hidden="true">{initials}</span>
        <span className="profile-label"><strong>{profile.nome}</strong><small>{roleLabels[profile.papel]}</small></span>
      </summary>
      <div className="profile-dropdown">
        <div><strong>{profile.nome}</strong><small>{roleLabels[profile.papel]}</small></div>
        <a href={panelHref('configuracoes')} onClick={() => menu.current?.removeAttribute('open')}>Configurações</a>
        <button type="button" onClick={onSignOut} disabled={pending}>{pending ? 'Saindo…' : 'Sair'}</button>
      </div>
    </details>
  )
}

export function PanelLayout({ current, children, profile, onSignOut }: {
  current?: ModuleId; children: ReactNode; profile: Profile | null; onSignOut?: () => Promise<void>
}) {
  const available = panelModules(profile?.papel)
  const { result, retry } = usePanelContext()
  const establishment = result.status === 'ready' ? result.data.estabelecimento : 'Pávolloskeys'
  const [compact, setCompact] = useState(false)
  const [palette, setPalette] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    function openPalette(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', openPalette)
    return () => window.removeEventListener('keydown', openPalette)
  }, [])

  async function signOut() {
    setLogoutPending(true)
    setLogoutError('')
    try {
      await onSignOut?.()
    } catch (error) {
      setLogoutError(apiErrorMessage(error, 'Não foi possível encerrar a sessão. Tente novamente.'))
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <div className={`panel-shell${compact ? ' panel-compact' : ''}`}>
      <aside className="sidebar" data-surface="night">
        <div className="sidebar-brand"><Brand /></div>
        <div className="sidebar-store" title={establishment}>
          <Icon name="shop" size={17} /><span>{establishment}</span>
        </div>
        <PanelNavigation current={current} available={available} />
        <HomeLink />
      </aside>
      <div className="panel-workspace">
        <header className="panel-header">
          <div className="panel-breadcrumb">
            <button type="button" className="icon-button sidebar-toggle" onClick={() => setCompact(!compact)}
              aria-label={compact ? 'Expandir barra lateral' : 'Recolher barra lateral'} aria-expanded={!compact}>
              <Icon name="panel" size={18} />
            </button>
            <MobileMenu title={establishment}>
              <PanelNavigation current={current} available={available} />
              <HomeLink />
            </MobileMenu>
            <div className="panel-header-title">
              <span>{establishment}</span>
              <strong>{current ? modules[current].title : 'Central de operações'}</strong>
            </div>
          </div>
          <div className="panel-header-actions">
            <button type="button" className="panel-search" aria-label="Buscar no painel" aria-keyshortcuts="Control+k Meta+k"
              onClick={() => setPalette(true)}>
              <Icon name="search" size={18} /><span>Buscar</span><kbd>Ctrl K</kbd>
            </button>
            <ThemeToggle />
            {profile && <ProfileMenu profile={profile} pending={logoutPending} onSignOut={() => void signOut()} />}
          </div>
        </header>
        <main id="conteudo" className="panel-main" tabIndex={-1}>
          {!profile && <div className="panel-mode"><StatusLabel>Dados de demonstração</StatusLabel></div>}
          {result.status === 'error' && (
            <div className="panel-context-error" role="status">
              Nome do estabelecimento indisponível. <button type="button" className="text-link" onClick={retry}>Tentar novamente</button>
            </div>
          )}
          {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
          {current && !available.includes(current)
            ? <p className="state-box" role="alert">Seu perfil não tem acesso a este módulo.</p>
            : children}
        </main>
      </div>
      <MobileActions current={current} technical={profile?.papel === 'tecnico'} />
      {palette && (
        <CommandPalette onClose={() => setPalette(false)} links={[
          ...workActions(profile?.papel),
          { title: 'Central de operações', href: panelHref(), icon: 'grid' },
          ...available.map((id) => ({ title: modules[id].title, href: panelHref(id), icon: modules[id].icon })),
        ]} />
      )}
    </div>
  )
}
