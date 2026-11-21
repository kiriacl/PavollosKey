import { useEffect, useState } from 'react'
import { getPanelContext } from '../services/panel'
import type { PanelContext } from '../types/panel'

type Result = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: PanelContext }

export function usePanelContext() {
  const [result, setResult] = useState<Result>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getPanelContext(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ status: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ status: 'error' })
      })
    return () => controller.abort()
  }, [attempt])

  function retry() {
    setResult({ status: 'loading' })
    setAttempt((value) => value + 1)
  }
  return { result, retry }
}
