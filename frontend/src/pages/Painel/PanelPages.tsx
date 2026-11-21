import { Icon } from '../../components/ui/Icon'
import { AreaCard } from '../../components/ui/AreaCard'
import { StatusLabel } from '../../components/ui/StatusLabel'
import { usePanelContext } from '../../hooks/usePanelContext'
import { modules, panelHref } from '../../routes/routes'
import type { ModuleId } from '../../types/panel'

export function OverviewPage() {
  const { result, retry } = usePanelContext()
  return (
    <>
      <div className="panel-intro">
        <p className="eyebrow">
          <span />
          Painel administrativo
        </p>
        <h1>Visão geral</h1>
        <p>Explore as áreas previstas para a rotina do estabelecimento.</p>
      </div>
      {result.status === 'loading' && (
        <p className="state-box" role="status">
          Carregando os atalhos do painel…
        </p>
      )}
      {result.status === 'error' && (
        <div className="state-box" role="alert">
          <p>Os atalhos do painel estão indisponíveis. Confira a conexão e tente novamente.</p>
          <button type="button" onClick={retry} className="button button-primary">
            Tentar novamente
          </button>
        </div>
      )}
      {result.status === 'ready' && (
        <section aria-labelledby="atalhos-titulo">
          <div className="shortcuts-heading">
            <h2 id="atalhos-titulo">Atalhos do painel</h2>
            <span>
              <Icon name="shop" size={17} />
              {result.data.estabelecimento}
            </span>
          </div>
          {result.data.atalhos.length === 0 ? (
            <p className="state-box">Nenhum atalho disponível. Use o menu para acessar os módulos.</p>
          ) : (
            <div className="shortcut-grid">
              {result.data.atalhos.map((id) => (
                <AreaCard
                  key={id}
                  href={panelHref(id)}
                  icon={modules[id].icon}
                  title={modules[id].title}
                  description={modules[id].description}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

export function ModulePage({ id }: { id: ModuleId }) {
  const info = modules[id]
  return (
    <>
      <div className="panel-intro">
        <p className="eyebrow">
          <span />
          Área de trabalho
        </p>
        <h1>{info.title}</h1>
        <p>{info.description}</p>
      </div>
      <section className="scope-card" aria-labelledby="escopo-titulo">
        <div className="scope-heading">
          <span className="icon-tile">
            <Icon name={info.icon} size={25} />
          </span>
          <StatusLabel proposal>Proposta</StatusLabel>
        </div>
        <h2 id="escopo-titulo">Escopo previsto</h2>
        <p>Funcionalidades em discussão para as próximas etapas.</p>
        <ul>
          {info.scope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a href={panelHref()} className="text-link">
          Voltar à visão geral
        </a>
      </section>
    </>
  )
}
