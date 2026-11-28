import { useState, type ReactNode } from 'react'
import { modules, panelHref } from '../../routes/routes'
import { type Profile, roleLabels } from '../../services/auth'
import { apiErrorMessage } from '../../services/http'
import { moduleIds, type ModuleId } from '../../types/panel'
import { Brand } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { StatusLabel } from '../ui/StatusLabel'
import { MobileMenu } from './MobileMenu'

const technicalModules: ModuleId[] = ['servicos', 'historico', 'configuracoes']

function PanelNavigation({ current, available }: { current?: ModuleId; available: readonly ModuleId[] }) {
  return (
    <nav className="panel-nav" aria-label="Módulos do painel">
      <a href={panelHref()} aria-current={!current ? 'page' : undefined}>
        <Icon name="grid" />
        Visão geral
      </a>
      {available.map((id) => (
        <a href={panelHref(id)} key={id} aria-current={current === id ? 'page' : undefined}>
          <Icon name={modules[id].icon} />
          {modules[id].title}
        </a>
      ))}
    </nav>
  )
}

function HomeLink() {
  return (
    <a className="home-link" href="#inicio">
      <Icon name="home" size={18} />
      Voltar ao início
    </a>
  )
}

export function PanelLayout({ current, children, profile, onSignOut }: {
  current?: ModuleId; children: ReactNode; profile: Profile | null; onSignOut?: () => Promise<void>
}) {
  const available = profile?.papel === 'tecnico' ? technicalModules : moduleIds
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
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
    <div className="panel-shell">
      <aside className="sidebar">
        <Brand />
        <p className="nav-heading">Área de trabalho</p>
        <PanelNavigation current={current} available={available} />
        <HomeLink />
      </aside>
      <div className="panel-workspace">
        <header className="panel-header">
          <div className="panel-breadcrumb">
            <MobileMenu title="Área de trabalho">
              <PanelNavigation current={current} available={available} />
              <HomeLink />
            </MobileMenu>
            <span>Painel</span>
            <span aria-hidden="true">/</span>
            <strong>{current ? modules[current].title : 'Visão geral'}</strong>
          </div>
          {profile ? (
            <div className="panel-session-actions">
              <span>{profile.nome} · {roleLabels[profile.papel]}</span>
              <button type="button" className="text-link" onClick={signOut} disabled={logoutPending}>
                {logoutPending ? 'Saindo…' : 'Sair'}
              </button>
            </div>
          ) : <StatusLabel>Dados de demonstração</StatusLabel>}
        </header>
        <main id="conteudo" className="panel-main" tabIndex={-1}>
          {logoutError && <p className="state-box" role="alert">{logoutError}</p>}
          {current && !available.includes(current)
            ? <p className="state-box" role="alert">Seu perfil não tem acesso a este módulo.</p>
            : children}
        </main>
      </div>
    </div>
  )
}
