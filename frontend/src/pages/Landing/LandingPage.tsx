import { KeyShowcase } from '../../components/3d/KeyShowcase'
import { LandingHeader } from '../../components/layout/LandingHeader'
import { Brand } from '../../components/ui/Brand'
import { AreaCard } from '../../components/ui/AreaCard'
import { Icon, type IconName } from '../../components/ui/Icon'
import { modules, panelHref } from '../../routes/routes'
import type { ModuleId } from '../../types/panel'

const features: { title: string; text: string; icon: IconName; areas: ModuleId[]; color: string }[] = [
  {
    title: 'Atendimento ao cliente',
    text: 'Cadastros e pedidos de serviço recebidos no balcão, por telefone ou WhatsApp.',
    icon: 'users',
    areas: ['clientes', 'solicitacoes'],
    color: 'blue',
  },
  {
    title: 'Atendimento em campo',
    text: 'Agenda de visitas, endereços de atendimento e acompanhamento de cada serviço.',
    icon: 'calendar',
    areas: ['visitas', 'servicos'],
    color: 'teal',
  },
  {
    title: 'Gestão da oficina',
    text: 'Consulta de orçamentos, taxas de deslocamento e materiais da oficina.',
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
                Do primeiro contato à conclusão do serviço, organize clientes, visitas e atendimentos em um só
                painel.
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
              <p>Explore as áreas previstas para acompanhar cada parte da rotina do seu chaveiro.</p>
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
                Sobre o projeto
              </p>
              <h2 id="project-title">De Chaveiro Fácil a PávollosKeys.</h2>
            </div>
            <div>
              <p>
                O PávollosKeys é um projeto acadêmico de Engenharia de Software baseado no Chaveiro Fácil. A
                proposta reúne em um único ambiente o trabalho do balcão e os atendimentos externos.
              </p>
              <p>Esta primeira versão permite conhecer a navegação com dados fictícios.</p>
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
          <span>Projeto acadêmico de Engenharia de Software</span>
        </div>
      </footer>
    </div>
  )
}
