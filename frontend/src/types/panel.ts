export const moduleIds = [
  'clientes',
  'solicitacoes',
  'visitas',
  'orcamentos',
  'servicos',
  'estoque',
  'historico',
  'configuracoes',
] as const

export type ModuleId = (typeof moduleIds)[number]

export function isModuleId(value: unknown): value is ModuleId {
  return moduleIds.some((id) => id === value)
}

// Contrato de leitura proposto. Os atalhos não representam permissões.
export interface PanelContext {
  estabelecimento: string
  atalhos: ModuleId[]
}
