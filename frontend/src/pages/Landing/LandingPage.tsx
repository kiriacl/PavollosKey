import { productName } from '../../brand'
import { LandingHeader } from '../../components/layout/LandingHeader'
import { Brand, BrandMark } from '../../components/ui/Brand'
import { Icon } from '../../components/ui/Icon'
import { panelHref } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import { HeroPanel, PanelPreview } from './PanelPreview'
import { ServiceJourney } from './ServiceJourney'
import { incoming } from './story'
import './landing.css'

const imageBase = import.meta.env.BASE_URL

function FirstContact() {
  return (
    <section className="story-hero" id="inicio" aria-labelledby="hero-title">
      <div className="story-container hero-composition">
        <div className="hero-copy">
          <p className="hero-kicker"><span /> Gestão para chaveiros</p>
          <h1 id="hero-title">Seu trabalho é abrir portas. <em>Não perder tempo.</em></h1>
          <p>Organize clientes, atendimentos e ordens de serviço. Do primeiro chamado à entrega, tudo fica no mesmo lugar.</p>
          <div className="story-actions">
            <a href={panelHref()} className="story-button story-button-primary">
              {usingMocks ? 'Abrir demonstração' : 'Acessar o sistema'}<Icon name="arrow" size={18} />
            </a>
            <a href="#atendimento" className="story-button story-button-quiet">Acompanhar um atendimento <Icon name="arrow" size={17} /></a>
          </div>
        </div>
        <HeroPanel />
      </div>
      <div className="story-container intro-guide">
        <a href="#funcionalidades"><Icon name="arrow" size={17} /> Veja como a história começa</a>
        <span>Do primeiro chamado à entrega</span>
      </div>
    </section>
  )
}

function IncomingDemands() {
  return (
    <section id="funcionalidades" className="story-incoming" aria-labelledby="incoming-title">
      <div className="story-container incoming-layout">
        <div className="chapter-opening">
          <span className="chapter-tag">02 / A rotina</span>
          <h2 id="incoming-title">Tudo chega ao mesmo tempo.</h2>
          <p>Uma ligação atrasa a resposta de uma mensagem. Enquanto isso, um orçamento espera retorno e outra ordem já pode começar.</p>
          <p className="story-disclosure">Exemplo ilustrativo. As mensagens e ligações chegam pelos canais da oficina. O registro no sistema é feito pela equipe.</p>
        </div>
        <ol className="incoming-feed" aria-label="Quatro demandas de uma manhã na oficina">
          {incoming.map(({ time, title, source, icon, note }) => (
            <li key={time} className="incoming-event story-reveal">
              <time dateTime={time}>{time}</time>
              <div className="incoming-message">
                <span className="incoming-icon"><Icon name={icon} size={19} /></span>
                <div><span className="incoming-source">{source}</span><h3>{title}</h3><p>{note}</p></div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function OrganizedDemands() {
  return (
    <section className="story-organized" aria-labelledby="organized-title">
      <div className="story-container">
        <div className="chapter-opening organized-intro">
          <div>
            <span className="chapter-tag">03 / Do caos ao controle</span>
            <h2 id="organized-title">Tudo encontra seu lugar.</h2>
          </div>
          <p>Com os dados registrados no painel, você sabe de quem é cada chamado, o que aguarda resposta e qual serviço pode começar.</p>
        </div>
        <div className="queue-board">
          <div className="queue-heading"><span><BrandMark /> Fila de trabalho</span><span>Dados ilustrativos</span></div>
          <ul className="queue-list">
            {incoming.map(({ time, title, person, status, icon }) => (
              <li key={time} className="queue-row story-converge">
                <span className="queue-icon"><Icon name={icon} size={19} /></span>
                <div><strong>{title}</strong><span>{person}</span></div>
                <time dateTime={time}>{time}</time>
                <span className="queue-status">{status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function FieldUse() {
  return (
    <section className="story-field" aria-labelledby="field-title">
      <div className="story-container field-layout">
        <div className="chapter-opening">
          <span className="chapter-tag">06 / No balcão e em campo</span>
          <h2 id="field-title">O atendimento vai com você.</h2>
          <p>No balcão, acompanhe a fila de trabalho. Durante um chamado, consulte os dados da solicitação e do cliente pelo celular.</p>
          <p className="story-disclosure">Capturas do Pávolloskeys em modo demonstração.</p>
        </div>
        <figure className="device-composition">
          <img className="device-desktop" src={imageBase + 'demo-desktop.webp'} width="1280" height="880" loading="lazy" decoding="async"
            alt="Dashboard do Pávolloskeys no computador, com indicadores, gráficos e solicitações recentes." />
          <img className="device-mobile" src={imageBase + 'demo-mobile.webp'} width="390" height="740" loading="lazy" decoding="async"
            alt="Detalhes de uma solicitação de abertura residencial no celular." />
        </figure>
      </div>
    </section>
  )
}

export function LandingPage() {
  return (
    <div className="landing">
      <LandingHeader />
      <main id="conteudo" tabIndex={-1}>
        <FirstContact />
        <IncomingDemands />
        <OrganizedDemands />
        <ServiceJourney />
        <section id="projeto" className="story-product" aria-labelledby="product-title">
          <div className="story-container">
            <div className="chapter-opening product-intro">
              <div><span className="chapter-tag">05 / O produto</span><h2 id="product-title">Um painel para o dia inteiro.</h2></div>
              <p>Explore os módulos para ver como indicadores, cadastros, propostas e ordens se conectam.</p>
            </div>
            <PanelPreview />
            <p className="product-scope">Orçamentos, ordens e histórico funcionam com a API. Agenda de visitas e estoque estão planejados.</p>
          </div>
        </section>
        <FieldUse />
        <section className="story-ending" aria-labelledby="ending-title">
          <div className="story-container ending-composition">
            <div>
              <span className="chapter-tag">07 / O próximo chamado</span>
              <h2 id="ending-title">Você abre portas. <span>Nós organizamos o caminho.</span></h2>
            </div>
            <div className="story-actions">
              <a href={panelHref()} className="story-button story-button-primary">{usingMocks ? 'Abrir demonstração' : 'Acessar o sistema'}<Icon name="arrow" size={18} /></a>
              <a href="#projeto" className="story-button story-button-quiet">Explorar a prévia</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="story-footer">
        <div className="story-container footer-composition">
          <Brand />
          <nav aria-label="Rodapé">
            <a href="#atendimento">A jornada</a><a href="#projeto">Produto</a><a href={panelHref()}>Painel <Icon name="diagonal" size={15} /></a>
          </nav>
          <small>© {productName}</small>
        </div>
      </footer>
    </div>
  )
}
