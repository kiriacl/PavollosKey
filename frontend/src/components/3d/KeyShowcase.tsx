import { Component, lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react'
import { productName } from '../../brand'
import { useSceneAvailability } from '../../hooks/useSceneAvailability'
import { Icon } from '../ui/Icon'

const KeyScene = lazy(() => import('./KeyScene'))

// A barreira de erro do React protege a página se o módulo 3D ou o renderizador falhar.
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Poster() {
  return (
    <img
      className="key-poster"
      src={import.meta.env.BASE_URL + 'key-preview.webp'}
      alt=""
      width="840"
      height="560"
      decoding="async"
    />
  )
}

function ModelView({ interactive, visible }: { interactive: boolean; visible: boolean }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)
  const onError = useCallback(() => setFailed(true), [])
  const onReady = useCallback(() => setReady(true), [])
  const hasScene = interactive && !failed
  const live = hasScene && ready
  return (
    <>
      <div className="key-viewport" aria-hidden="true">
        {!live && <Poster />}
        {hasScene && (
          <SceneBoundary onError={onError}>
            <Suspense fallback={null}>
              <KeyScene playing={visible && !paused} onReady={onReady} onLost={onError} />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <figcaption className="model-caption">
        <span>
          <Icon name="cube" size={15} />
          {live ? 'Modelo 3D' : 'Vista da chave'}
        </span>
        {live && (
          <button
            type="button"
            className="motion-button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Retomar animação' : 'Pausar animação'}
            title={paused ? 'Retomar animação' : 'Pausar animação'}
          >
            <Icon name={paused ? 'play' : 'pause'} size={13} />
          </button>
        )}
      </figcaption>
    </>
  )
}

export function KeyShowcase() {
  const container = useRef<HTMLElement>(null)
  const { enabled, visible } = useSceneAvailability(container)
  return (
    <figure
      className="key-stage"
      data-surface="night"
      ref={container}
      aria-label={`Chave do ${productName} com lâmina metálica e cabeça azul com o monograma PK`}
    >
      <div className="stage-grid" aria-hidden="true" />
      <div className="stage-dial" aria-hidden="true" />
      <span className="registration mark-nw" aria-hidden="true" />
      <span className="registration mark-ne" aria-hidden="true" />
      <span className="registration mark-sw" aria-hidden="true" />
      <span className="registration mark-se" aria-hidden="true" />
      <ModelView key={enabled ? 'interactive' : 'static'} interactive={enabled} visible={visible} />
    </figure>
  )
}
