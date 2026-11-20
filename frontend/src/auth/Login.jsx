import { Access } from './Access'
import React, { useState } from 'react'
import { api } from '../shared/api.js'
import { Brand, Notice } from '../shared/ui.jsx'
import { Compass, ArrowRight } from 'lucide-react'
function Art() {
  return (
    <div className="art" aria-hidden="true">
      {[
        'arc',
        'dot',
        'stripe',
        'leaf',
        'stripe',
        'leaf',
        'arc',
        'dot',
        'leaf',
        'arc',
        'dot',
        'stripe',
      ].map((v, i) => (
        <i className={v} key={i} />
      ))}
    </div>
  )
}
export function Login({ refresh }) {
  const [mode, setMode] = useState(
    location.hash.startsWith('#reset=') ? 'reset' : 'login'
  )
  const demos = { Employee: 'alex', Manager: 'sam', HR: 'ellis' }
  const [role, setRole] = useState('Employee'),
    [email, setEmail] = useState('alex@joinflow.example'),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/auth/login', { email, password })
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login">
      <section className="cover">
        <Brand />
        <div className="covercopy">
          <div className="eyebrow">
            <span className="tinyline" />
            EMPLOYEE ONBOARDING
          </div>
          <h1>
            A clearer path
            <br />
            to day one<span>.</span>
          </h1>
          <p>
            Your checklist, your team, and the answers you need before you
            start.
          </p>
        </div>
        <Art />
        <div className="coverfoot">
          <Compass size={16} /> JoinFlow workspace
        </div>
      </section>
      <section className="signin">
        {mode !== 'login' ? (
          <Access
            mode={mode}
            role={role}
            back={() => {
              history.replaceState(null, '', location.pathname)
              setMode('login')
            }}
          />
        ) : (
          <form onSubmit={submit}>
            <div className="iconbox">
              <Compass />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to your onboarding workspace.</p>
            <fieldset aria-label="Account role">
              <div className="roles">
                {Object.keys(demos).map((r) => (
                  <button
                    type="button"
                    aria-pressed={role === r}
                    className={role === r ? 'selected' : ''}
                    key={r}
                    onClick={() => {
                      setRole(r)
                      setEmail(demos[r] + '@joinflow.example')
                      setError('')
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <Notice value={error} />
            <button disabled={busy} className="primary wide">
              {busy ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
            <div className="actions">
              <button type="button" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
              {role !== 'Employee' && (
                <button type="button" onClick={() => setMode('register')}>
                  Sign up as {role}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
