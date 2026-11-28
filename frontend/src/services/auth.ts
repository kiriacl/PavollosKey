import { getJson, writeJson } from './http'

export type Role = 'proprietario' | 'auxiliar' | 'tecnico'
export type Profile = { id: string; nome: string; papel: Role; ativo: true }

export const roleLabels: Record<Role, string> = {
  proprietario: 'Proprietário',
  auxiliar: 'Auxiliar',
  tecnico: 'Técnico',
}

export const getProfile = (signal: AbortSignal) => getJson<Profile>('/perfil', signal)
export const login = (email: string, password: string) => writeJson<{ perfil: Profile }>('/auth/login', 'POST', { email, password })
export const logout = () => writeJson<void>('/auth/logout', 'POST')
