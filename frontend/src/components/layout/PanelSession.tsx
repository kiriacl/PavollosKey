import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ProfileContext } from '../../hooks/useProfile'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getProfile, login, logout, type Profile } from '../../services/auth'
import { apiErrorMessage, HttpError, sessionExpired, usingMocks } from '../../services/http'
import { Brand } from '../ui/Brand'
import { DataState } from '../ui/DataState'

export function PanelSession({ children }: { children: (profile: Profile | null, signOut?: () => Promise<void>) => ReactNode }) {
  return usingMocks ? children(null) : <LiveSession>{children}</LiveSession>
}

function LiveSession({ children }: { children: (profile: Profile, signOut: () => Promise<void>) => ReactNode }) {
  const { result, retry } = useAsyncData(getProfile)
  const [override, setOverride] = useState<Profile | null>()
  const profile = override === undefined && result.status === 'ready' ? result.data : override

  useEffect(() => {
    const expire = () => setOverride(null)
    window.addEventListener(sessionExpired, expire)
    return () => window.removeEventListener(sessionExpired, expire)
  }, [])

  async function signOut() {
    await logout()
    setOverride(null)
  }

  if (profile) return <ProfileContext.Provider value={profile}>{children(profile, signOut)}</ProfileContext.Provider>

  const denied = result.status === 'error' && result.error instanceof HttpError && [401, 403].includes(result.error.status)
  return (
    <main id="conteudo" className="missing-page" tabIndex={-1}>
      <section className="scope-card session-card">
        <Brand />
        <h1>Acesso ao painel</h1>
        {override === undefined && result.status === 'loading' ? (
          <DataState status="loading" message="Verificando a sessão…" />
        ) : override === undefined && result.status === 'error' && !denied ? (
          <DataState status="error" message="Não foi possível verificar a sessão." onRetry={retry} />
        ) : (
          <LoginForm onLogin={setOverride} profileDenied={override === undefined && denied
            && result.error instanceof HttpError && result.error.status === 403} />
        )}
        <a className="text-link" href="#inicio">Voltar ao início</a>
      </section>
    </main>
  )
}

function LoginForm({ onLogin, profileDenied }: { onLogin: (profile: Profile) => void; profileDenied: boolean }) {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const data = new FormData(event.currentTarget)
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const { perfil } = await login(String(data.get('email')), String(data.get('password')))
      onLogin(perfil)
    } catch (problem) {
      setError(apiErrorMessage(problem, 'Não foi possível entrar. Confira a conexão e tente novamente.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form className="operation-form" onSubmit={submit}>
      <label>E-mail<input name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy} /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" maxLength={1024} required disabled={busy} /></label>
      {(error || profileDenied) && <p role="alert">{error || 'Esta conta precisa de um perfil ativo para acessar o painel.'}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  )
}
