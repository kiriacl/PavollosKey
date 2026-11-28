import { useEffect, useState } from 'react'
import { panelHref, sections } from '../../routes/routes'
import { Brand } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { MobileMenu } from './MobileMenu'

export function LandingHeader() {
  const [current, setCurrent] = useState<string>('inicio')

  useEffect(() => {
    const elements = sections.map((section) => document.getElementById(section.id))
    function onScroll() {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      const active = elements.findLast(
        (element) => element && element.getBoundingClientRect().top < window.innerHeight / 3,
      )
      setCurrent(atBottom ? 'projeto' : (active?.id ?? 'inicio'))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const links = (
    <nav className="landing-nav" aria-label="Seções da apresentação">
      {sections.map((section) => (
        <a
          key={section.id}
          href={'#' + section.id}
          aria-current={current === section.id ? 'location' : undefined}
        >
          {section.label}
        </a>
      ))}
    </nav>
  )

  return (
    <header className="site-header">
      <div className="container header-row">
        <Brand />
        <div className="desktop-links">{links}</div>
        <div className="header-actions">
          <ThemeToggle />
          <a href={panelHref()} className="button button-secondary header-access" aria-label="Acessar painel">
            <span>Painel</span>
            <Icon name="diagonal" size={15} />
          </a>
          <MobileMenu title="Navegação">{links}</MobileMenu>
        </div>
      </div>
    </header>
  )
}
