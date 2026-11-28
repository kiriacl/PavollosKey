import { productName } from '../../brand'
import { KeyShowcase } from '../../components/3d/KeyShowcase'
import { LandingHeader } from '../../components/layout/LandingHeader'
import { Brand } from '../../components/ui/Brand'
import { Icon } from '../../components/ui/Icon'
import { panelHref } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import { PanelPreview } from './PanelPreview'
import './landing.css'

const workflow = [
  { title: 'Clientes e solicitações', text: 'Encontre o contato, registre o pedido e acompanhe o atendimento sem perder o contexto.', icon: 'requests', id: 'solicitacoes' },
  { title: 'Orçamentos', text: 'Monte propostas por item e registre a decisão do cliente.', icon: 'quote', id: 'orcamentos' },
  { title: 'Ordens de serviço', text: 'Atribua o trabalho e acompanhe a execução até a conclusão.', icon: 'tools', id: 'servicos' },
] as const

export function LandingPage() {
  return (
    <div className="landing">
      <LandingHeader />
      <main id="conteudo" tabIndex={-1}>
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="container hero-layout">
            <div className="hero-copy">
              <p className="eyebrow"><span />Gestão para chaveiros</p>
              <h1 id="hero-title">Sua oficina,<br /><em>sob controle.</em></h1>
              <p className="hero-description">
                Organize clientes, atendimentos, orçamentos e ordens de serviço em um só lugar, do balcão à entrega.
              </p>
              <div className="hero-actions">
                <a href={panelHref()} className="button button-primary">
                  {usingMocks ? 'Abrir demonstração' : 'Acessar painel'}
                  <Icon name="arrow" size={18} />
                </a>
                <a href="#funcionalidades" className="button button-secondary">Conhecer o fluxo</a>
              </div>
            </div>
            <KeyShowcase />
          </div>
        </section>

        <section className="workflow-section" id="funcionalidades" aria-labelledby="features-title">
          <div className="container">
            <div className="section-intro">
              <h2 id="features-title">Do primeiro pedido<br />à entrega.</h2>
              <p>Consulte quem pediu o serviço, o que foi aprovado e em que etapa está o trabalho.</p>
            </div>
            <div className="workflow-grid">
              {workflow.map(({ title, text, icon, id }) => {
                const inDemo = id === 'solicitacoes'
                return (
                  <article className="workflow-item reveal" key={id}>
                    <span className="icon-tile"><Icon name={icon} size={22} /></span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    {inDemo ? (
                      <div className="workflow-links">
                        <a href={panelHref('clientes')} className="text-link">Clientes <Icon name="diagonal" size={14} /></a>
                        <a href={panelHref(id)} className="text-link">Solicitações <Icon name="diagonal" size={14} /></a>
                      </div>
                    ) : (
                      <a href={panelHref(id)} className="workflow-status"
                        aria-label={usingMocks ? `${title} · Disponível no modo API` : `Abrir no painel · ${title}`}>
                        {usingMocks ? 'Disponível no modo API' : 'Abrir no painel'} <Icon name="diagonal" size={14} />
                      </a>
                    )}
                  </article>
                )
              })}
            </div>
            <div className="workflow-planned">
              <Icon name="calendar" size={19} />
              <p><strong>Planejado</strong> · Agenda de visitas e controle de estoque.</p>
            </div>
          </div>
        </section>

        <section id="projeto" className="preview-section" aria-labelledby="preview-title" data-surface="night">
          <div className="container preview-layout">
            <div className="preview-copy">
              <p className="eyebrow"><span />Prévia do painel</p>
              <h2 id="preview-title">Veja o que precisa de atenção.</h2>
              <p>Alterne entre os indicadores, os contatos e os pedidos para conhecer a rotina do painel.</p>
              <a href={panelHref()} className="button button-primary">
                {usingMocks ? 'Explorar demonstração' : 'Entrar no painel'}
                <Icon name="arrow" size={18} />
              </a>
            </div>
            <PanelPreview />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <div>
            <Brand />
            <p>Gestão para chaveiros.</p>
          </div>
          <nav aria-label="Rodapé">
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#projeto">Prévia do painel</a>
            <a href={panelHref()}>Painel <Icon name="diagonal" size={14} /></a>
          </nav>
          <small>© {productName}</small>
        </div>
      </footer>
    </div>
  )
}
