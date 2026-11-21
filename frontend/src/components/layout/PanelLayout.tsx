import type { ReactNode } from 'react'
import { modules, panelHref } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import { moduleIds, type ModuleId } from '../../types/panel'
import { Brand } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { StatusLabel } from '../ui/StatusLabel'
import { MobileMenu } from './MobileMenu'

function PanelNavigation({ current }: { current?: ModuleId }) {
  return (
    <nav className="panel-nav" aria-label="Módulos do painel">
      <a href={panelHref()} aria-current={!current ? 'page' : undefined}>
        <Icon name="grid" />
        Visão geral
      </a>
      {moduleIds.map((id) => (
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

export function PanelLayout({ current, children }: { current?: ModuleId; children: ReactNode }) {
  return (
    <div className="panel-shell">
      <aside className="sidebar">
        <Brand />
        <p className="nav-heading">Área de trabalho</p>
        <PanelNavigation current={current} />
        <HomeLink />
      </aside>
      <div className="panel-workspace">
        <header className="panel-header">
          <div className="panel-breadcrumb">
            <MobileMenu title="Área de trabalho">
              <PanelNavigation current={current} />
              <HomeLink />
            </MobileMenu>
            <span>Painel</span>
            <span aria-hidden="true">/</span>
            <strong>{current ? modules[current].title : 'Visão geral'}</strong>
          </div>
          <StatusLabel>{usingMocks ? 'Dados fictícios' : 'Prévia com API'}</StatusLabel>
        </header>
        <main id="conteudo" className="panel-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
