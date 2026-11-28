import { productName } from '../../brand'
import { KeyShowcase } from '../../components/3d/KeyShowcase'
import { LandingHeader } from '../../components/layout/LandingHeader'
import { Brand } from '../../components/ui/Brand'
import { AreaCard } from '../../components/ui/AreaCard'
import { Icon, type IconName } from '../../components/ui/Icon'
import { modules, panelHref } from '../../routes/routes'
import type { ModuleId } from '../../types/panel'

const features: { title: string; text: string; icon: IconName; areas: ModuleId[]; color: string }[] = [
  {
    title: 'Clientes e solicitações',
    text: 'Gerencie cadastros de clientes, registre solicitações de serviço e acompanhe seu status.',
    icon: 'users',
    areas: ['clientes', 'solicitacoes'],
    color: 'blue',
  },
  {
    title: 'Visitas e serviços',
    text: 'Consulte indicadores de visitas e serviços. A agenda e o acompanhamento individual estão previstos.',
    icon: 'calendar',
    areas: ['visitas', 'servicos'],
    color: 'teal',
  },
  {
    title: 'Gestão da oficina',
    text: 'A gestão de orçamentos e o controle de estoque estão previstos para a rotina da oficina.',
    icon: 'box',
    areas: ['orcamentos', 'estoque'],
    color: 'violet',
  },
]

export function LandingPage() {
  return (
    <div className="landing">
      <LandingHeader />
      <main id="conteudo" tabIndex={-1}>
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="container hero-layout">
            <div className="hero-copy">
              <p className="eyebrow">
                <span />
                Gestão para chaveiros
              </p>
              <h1 id="hero-title">
                Seu chaveiro,
                <br />
                <em>sob controle.</em>
              </h1>
              <p className="hero-description">
                Gerencie os cadastros de clientes e acompanhe indicadores de solicitações, serviços e visitas em um
                só painel.
              </p>
              <div className="hero-actions">
                <a href={panelHref()} className="button button-primary">
                  <Icon name="grid" size={18} />
                  Acessar sistema
                </a>
                <a href="#funcionalidades" className="button button-secondary">
                  Ver funcionalidades
                </a>
              </div>
            </div>
            <KeyShowcase />
          </div>
        </section>
        <section className="features-section" id="funcionalidades" aria-labelledby="features-title">
          <div className="container">
            <div className="section-intro">
              <div>
                <p className="eyebrow">
                  <span />
                  Funcionalidades
                </p>
                <h2 id="features-title">Da solicitação à entrega.</h2>
              </div>
              <p>Conheça o que já está disponível para demonstração e o que está previsto para o painel.</p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <AreaCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.text}
                  tone={feature.color}
                >
                  <div className="feature-links">
                    {feature.areas.map((id) => (
                      <a href={panelHref(id)} key={id}>
                        {modules[id].title}
                      </a>
                    ))}
                  </div>
                </AreaCard>
              ))}
            </div>
          </div>
        </section>
        <section id="projeto" className="about-section" aria-labelledby="project-title">
          <div className="container about-layout">
            <div>
              <p className="eyebrow">
                <span />
                Sobre a plataforma
              </p>
              <h2 id="project-title">{productName}</h2>
            </div>
            <div>
              <p>
                O {productName} é uma plataforma de gestão para chaveiros em desenvolvimento. Seu objetivo é
                centralizar a rotina do balcão e dos atendimentos externos.
              </p>
              <p>
                A demonstração inclui o painel de indicadores e o gerenciamento de clientes e solicitações. A gestão
                de atendimentos, visitas, orçamentos, pagamentos e estoque está prevista, assim como integrações de
                dados e automações.
              </p>
              <a href={panelHref()} className="text-link">
                Explorar o painel
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <Brand />
          <span>Plataforma de gestão para chaveiros</span>
        </div>
      </footer>
    </div>
  )
}
