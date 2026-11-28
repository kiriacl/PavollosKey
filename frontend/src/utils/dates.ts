const localDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
})
const civilDateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
const timestampFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
})

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && isCivilDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}

export function todayInSaoPaulo() {
  return dateInSaoPaulo(new Date())
}

export const dateInSaoPaulo = (value: string | Date) => localDate.format(new Date(value)).split('/').reverse().join('-')

export const formatCivilDate = (value: string) => civilDateFormat.format(new Date(value))
export const formatTimestamp = (value: string) => timestampFormat.format(new Date(value))
