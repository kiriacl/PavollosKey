import { demoPanel } from '../mocks/panel'
import { isModuleId, type PanelContext } from '../types/panel'
import { apiRoutes, getJson, usingMocks } from './http'

export async function getPanelContext(signal: AbortSignal): Promise<PanelContext> {
  signal.throwIfAborted()
  if (usingMocks) return demoPanel

  const data = await getJson(apiRoutes.panelContext, signal)
  if (
    typeof data !== 'object' ||
    data === null ||
    !('estabelecimento' in data) ||
    typeof data.estabelecimento !== 'string' ||
    !('atalhos' in data) ||
    !Array.isArray(data.atalhos) ||
    !data.atalhos.every(isModuleId)
  ) {
    throw new Error('O contexto do painel tem um formato inesperado.')
  }
  return { estabelecimento: data.estabelecimento, atalhos: [...new Set(data.atalhos)] }
}
