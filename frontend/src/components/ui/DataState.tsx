type DataStateProps =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'empty'; message: string }

export function DataState(props: DataStateProps) {
  if (props.status === 'loading') {
    return (
      <div className="state-box status-surface" data-state="loading" role="status">
        <div className="skeleton-lines" aria-hidden="true"><span /><span /></div>
        <p>{props.message}</p>
      </div>
    )
  }
  if (props.status !== 'error') {
    return <p className="state-box status-surface" data-state={props.status} role="status">{props.message}</p>
  }

  return (
    <div className="state-box status-surface" data-state="error">
      <p role="alert">{props.message}</p>
      <button type="button" onClick={props.onRetry} className="button button-primary">
        Tentar novamente
      </button>
    </div>
  )
}
