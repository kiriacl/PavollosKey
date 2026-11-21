import { getPanelContext } from '../services/panel'
import { useAsyncData } from './useAsyncData'

export function usePanelContext() {
  return useAsyncData(getPanelContext)
}
