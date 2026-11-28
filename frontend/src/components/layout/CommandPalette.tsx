import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { WorkLink } from '../../routes/panelNavigation'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'

function searchable(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR')
}

export function CommandPalette({ links, onClose }: { links: WorkLink[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLUListElement>(null)
  const matches = links.filter(({ title }) => searchable(title).includes(searchable(query)))

  useEffect(() => input.current?.focus(), [])

  function handleKeys(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const anchors = Array.from(results.current?.querySelectorAll('a') ?? [])
    const current = anchors.findIndex((anchor) => anchor === document.activeElement)
    const next = event.key === 'ArrowDown' ? current + 1 : current < 0 ? anchors.length - 1 : current - 1
    if (!anchors.length) return
    event.preventDefault()
    if (next < 0 || next >= anchors.length) input.current?.focus()
    else anchors[next].focus()
  }

  return (
    <Modal title="Buscar no painel" saving={false} onDismiss={onClose}>
      <div className="command-palette" onKeyDown={handleKeys}>
        <label className="command-input"><Icon name="search" size={18} />
          <span className="sr-only">Pesquisar páginas e ações</span>
          <input ref={input} type="search" placeholder="Pesquisar páginas e ações" value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length === 1) results.current?.querySelector('a')?.click()
            }} />
        </label>
        {!matches.length && <p className="command-empty" role="status">Nenhuma página ou ação encontrada.</p>}
        <ul ref={results}>
          {matches.map(({ href, title, icon }) => (
            <li key={title}>
              <a href={href} onClick={onClose}>
                <Icon name={icon} size={18} /><span>{title}</span><Icon name="arrow" size={16} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
