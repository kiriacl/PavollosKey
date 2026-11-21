type DataStateProps =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string; onRetry: () => void }

export function DataState(props: DataStateProps) {
  if (props.status === 'loading') {
    return <p className="state-box" role="status">{props.message}</p>
  }

  return (
    <div className="state-box">
      <p role="alert">{props.message}</p>
      <button type="button" onClick={props.onRetry} className="button button-primary">
        Tentar novamente
      </button>
    </div>
  )
}
