import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type AreaCardProps = {
  icon: IconName
  title: string
  description: string
} & ({ href: string; tone?: never; children?: never } | { href?: never; tone: string; children: ReactNode })

export function AreaCard({ icon, title, description, href, tone, children }: AreaCardProps) {
  const content = (
    <>
      <span className="icon-tile">
        <Icon name={icon} size={href ? 20 : 25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </>
  )
  if (href)
    return (
      <a className="shortcut-card" href={href}>
        {content}
      </a>
    )
  return (
    <article className={'feature-card ' + tone}>
      {content}
      {children}
    </article>
  )
}
