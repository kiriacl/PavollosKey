import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import './modal.css'

export function Modal({ title, saving, onDismiss, children }: {
  title: string
  saving: boolean
  onDismiss: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => {
    dialogRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [title])

  return (
    <dialog
      ref={dialogRef}
      className="record-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onDismiss()
      }}
    >
      <header className="record-dialog-header">
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
        <button type="button" className="icon-button" disabled={saving} onClick={onDismiss} aria-label="Fechar diálogo">
          <Icon name="close" />
        </button>
      </header>
      <div className="record-dialog-body">{children}</div>
    </dialog>
  )
}
