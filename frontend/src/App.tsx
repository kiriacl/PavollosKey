import { useEffect, useRef, useSyncExternalStore } from 'react'
import { PanelLayout } from './components/layout/PanelLayout'
import { LandingPage } from './pages/Landing/LandingPage'
import { ModulePage, OverviewPage } from './pages/Painel/PanelPages'
import { modules, parseRoute, sections } from './routes/routes'
import './App.css'

function subscribeToLocation(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export default function App() {
  const hash = useSyncExternalStore(subscribeToLocation, () => window.location.hash)
  const route = parseRoute(hash)
  const previousHash = useRef(hash)
  const title =
    route.page === 'module'
      ? modules[route.id].title
      : {
          landing: 'Gestão para chaveiros',
          overview: 'Visão geral',
          missing: 'Página não encontrada',
        }[route.page]

  useEffect(() => {
    document.title = title + ' | PávollosKeys'
    const changed = previousHash.current !== hash
    previousHash.current = hash
    const section = sections.find((item) => hash === '#' + item.id)
    const target = section ? document.getElementById(section.id) : null
    if (target) target.scrollIntoView()
    else if (changed) window.scrollTo({ top: 0, behavior: 'instant' })
    if (changed) {
      const heading = (target ?? document.querySelector('main'))?.querySelector<HTMLElement>('h1, h2')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    }
  }, [hash, title])

  return (
    <>
      <a
        className="skip-link"
        href="#conteudo"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('conteudo')?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      {route.page === 'landing' && <LandingPage />}
      {(route.page === 'overview' || route.page === 'module') && (
        <PanelLayout current={route.page === 'module' ? route.id : undefined}>
          {route.page === 'module' ? <ModulePage id={route.id} /> : <OverviewPage />}
        </PanelLayout>
      )}
      {route.page === 'missing' && (
        <main className="missing-page" id="conteudo" tabIndex={-1}>
          <p className="eyebrow">
            <span />
            Erro 404
          </p>
          <h1>Página não encontrada</h1>
          <a href="#inicio" className="button button-primary">
            Voltar ao início
          </a>
        </main>
      )}
    </>
  )
}
