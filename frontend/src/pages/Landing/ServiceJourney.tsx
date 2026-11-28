import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { journey } from './story'

const stickyLayout = '(min-width: 56rem) and (min-height: 38.01rem)'

export function StoryRecord({ index }: { index: number }) {
  const step = journey[index]
  return (
    <div className="story-record">
      <div className="record-top">
        <Icon name={step.icon} size={20} />
        <div><p>{step.screen}</p><span>Abertura residencial</span></div>
      </div>
      <dl className={index === journey.length - 1 ? 'record-fields record-timeline' : 'record-fields'}>
        {step.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="record-status"><i aria-hidden="true" />{step.status}</p>
    </div>
  )
}

export function ServiceJourney() {
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const steps = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const items = Array.from(steps.current?.children ?? [])
    const desktop = window.matchMedia(stickyLayout)
    let observer: IntersectionObserver | undefined

    function observeReadingPosition() {
      observer?.disconnect()
      if (!desktop.matches) return
      const inset = Math.floor(window.innerHeight / 2) - 2
      observer = new IntersectionObserver(() => {
        const center = window.innerHeight / 2
        const next = items.findIndex((item) => {
          const { top, bottom } = item.getBoundingClientRect()
          return top <= center && bottom > center
        })
        if (next >= 0) setActive(next)
      }, { rootMargin: `-${inset}px 0px -${inset}px 0px` })
      items.forEach((item) => observer?.observe(item))
    }

    observeReadingPosition()
    window.addEventListener('resize', observeReadingPosition)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', observeReadingPosition)
    }
  }, [])

  function choose(index: number) {
    if (index < 0 || index >= journey.length) return
    setActive(index)
    setAnnouncement(`Etapa ${index + 1} de ${journey.length}. ${journey[index].title}.`)
    if (window.matchMedia(stickyLayout).matches) {
      steps.current?.children[index]?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }

  return (
    <section id="atendimento" className="story-journey" aria-labelledby="journey-title">
      <div className="story-container">
        <div className="chapter-opening">
          <span className="chapter-tag">04 / Um atendimento</span>
          <h2 id="journey-title">Cada etapa deixa um registro.</h2>
          <p>Acompanhe o chamado de Mariana do primeiro contato ao histórico.</p>
        </div>
        <div className="journey-layout">
          <ol className="journey-steps" ref={steps} aria-label="Etapas do atendimento ilustrativo">
            {journey.map((step, index) => (
              <li key={step.title}>
                <button type="button" aria-current={active === index ? 'step' : undefined}
                  aria-label={`Etapa ${index + 1}. ${step.title}`} aria-controls="story-step" onClick={() => choose(index)}>
                  <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="step-description"><strong>{step.title}</strong><span>{step.text}</span></span>
                </button>
              </li>
            ))}
          </ol>

          <div className="journey-preview" id="story-step">
            <div className="journey-preview-top"><span>Atendimento ilustrativo</span><span>Etapa {active + 1} de {journey.length}</span></div>
            <div className="journey-progress" aria-hidden="true">
              {journey.map(({ title }, index) => <i key={title} data-complete={index <= active} />)}
            </div>
            <div className="journey-selected" key={active}>
              <h3>{journey[active].title}</h3>
              <p>{journey[active].text}</p>
              <StoryRecord index={active} />
            </div>
            <div className="journey-controls">
              <button type="button" onClick={() => choose(active - 1)} aria-disabled={active === 0}>
                <Icon name="arrow" size={17} />Anterior
              </button>
              <button type="button" onClick={() => choose(active + 1)} aria-disabled={active === journey.length - 1}>
                Próxima<Icon name="arrow" size={17} />
              </button>
            </div>
            <span className="sr-only" role="status">{announcement}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
