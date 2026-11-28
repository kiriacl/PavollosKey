import { useEffect, useState } from 'react'

type Result<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T }

export function useAsyncData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<Result<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ status: 'error', error })
      })
    return () => controller.abort()
  }, [attempt, load])

  function retry() {
    setResult({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  function updateData(update: (current: T) => T) {
    setResult((current) => current.status === 'ready' ? { status: 'ready', data: update(current.data) } : current)
  }

  return { result, retry, updateData }
}
