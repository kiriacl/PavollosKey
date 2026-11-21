import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'

export function MobileMenu({ title, children }: { title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const smallScreen = window.matchMedia('(max-width: 48rem)')
    function onResize() {
      if (!smallScreen.matches) dialog.current?.close()
    }
    smallScreen.addEventListener('change', onResize)
    return () => smallScreen.removeEventListener('change', onResize)
  }, [open])

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="icon-button"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
      >
        <Icon name="menu" />
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="menu-dialog"
        aria-labelledby={id + '-title'}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="menu-sheet">
          <div className="menu-heading">
            <strong id={id + '-title'}>{title}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar menu"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <div
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('a')) dialog.current?.close()
            }}
          >
            {children}
          </div>
        </div>
      </dialog>
    </div>
  )
}
