import { useState } from 'react'
import { useAuth } from '../lib/AuthProvider'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const errorMessage = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (errorMessage) {
      setError(errorMessage)
      return
    }
    if (mode === 'signup') {
      setInfo('Compte créé. Si la confirmation par email est activée, vérifie ta boîte mail avant de te connecter.')
    }
  }

  return (
    <div className="app-main" style={{ paddingTop: 64 }}>
      <h1>Révisions Terminale</h1>
      <p className="subtitle">Connecte-toi pour accéder à ton planning de révision.</p>

      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        {info && <p className="plan-item__meta">{info}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>

      <p className="subtitle">
        {mode === 'signin' ? "Pas encore de compte ? " : 'Déjà un compte ? '}
        <button
          type="button"
          className="link-button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? "S'inscrire" : 'Se connecter'}
        </button>
      </p>
    </div>
  )
}
