import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  RefreshCw,
  Users,
} from 'lucide-react'
import { Brand, Notice } from './shared/ui.jsx'
import { Login } from './auth/Login.jsx'
import { EmployeePortal } from './employee/Portal'
import { StaffPortal } from './staff/Portal'
import './style.css'
import { api } from './shared/api.js'
function App() {
  const route = () => {
    try {
      return decodeURIComponent(location.hash.replace(/^#view=/, ''))
    } catch {
      return ''
    }
  }
  const [user, setUser] = useState(null),
    [data, setData] = useState(null),
    [requested, selectTab] = useState(route),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  function setTab(value) {
    if (value === requested) return
    history.pushState(
      { joinflow: true },
      '',
      '#view=' + encodeURIComponent(value),
    )
    selectTab(value)
  }
  useEffect(() => {
    const update = () => selectTab(route())
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
    }
  }, [])
  const generation = useRef(0)
  async function refresh() {
    const attempt = ++generation.current
    try {
      const u = await api('/me')
      const d = await api(u.role === 'Employee' ? '/me/checklist' : '/team')
      if (attempt !== generation.current) return
      setUser(u)
      setData(d)
      setError('')
    } catch (e) {
      if (attempt !== generation.current) return
      if (e.status === 401) {
        setUser(null)
        setData(null)
      } else setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    refresh()
  }, [])
  async function act(path, body) {
    setBusy(true)
    setError('')
    try {
      const result = await api(path, body)
      await refresh()
      if (result.delivered === false)
        setError(
          'Hire created. Email delivery failed. Check SMTP and resend the setup email from Employees.',
        )
      return result
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  if (loading)
    return (
      <main className="loading">
        <Brand />
        <p>Loading workspace…</p>
      </main>
    )
  if (location.hash.startsWith('#reset='))
    return <Login key="reset" refresh={refresh} />
  if (!user)
    return error ? (
      <main className="loading">
        <Notice value={error} />
        <button onClick={refresh}>Retry</button>
      </main>
    ) : (
      <Login refresh={refresh} />
    )
  const nav =
    user.role === 'Employee'
      ? [
          'Dashboard',
          'My Tasks',
          'My Documents',
          'Equipment & Access',
          'AI Assistant',
          'Help & Support',
          'Notifications',
          'My Profile',
        ]
      : user.role === 'HR'
        ? [
            'Dashboard',
            'Employees',
            'New hire',
            'Plans',
            'Tasks',
            'Documents',
            'Escalations',
            'HR inbox',
            'Policies',
            'History',
          ]
        : [
            'Dashboard',
            'Employees',
            'Decisions',
            'Tasks',
            'Escalations',
            'Access & roles',
            'Policies',
            'History',
          ]
  const tab = nav.includes(requested.split('|')[0]) ? requested : 'Dashboard'
  const [page, detail] = tab.split('|')
  const pageTitle = [
    'All',
    'Pending',
    'Overdue',
    'Blocked',
    'Active',
    'Ready',
    'Joining soon',
    'Complete',
  ].includes(detail)
    ? page + ' / ' + detail
    : page
  const icons = {
    Dashboard: LayoutDashboard,
    'AI Assistant': MessageCircle,
    History: Clock3,
    'New hire': Users,
    'HR inbox': MessageCircle,
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="eyebrow">WORKSPACE</div>
        <nav>
          {nav.map((n) => {
            const Icon = icons[n] || ChevronRight
            return (
              <button
                key={n}
                className={tab.split('|')[0] === n ? 'current' : ''}
                onClick={() => {
                  setTab(n)
                  setError('')
                  refresh()
                }}
              >
                <Icon size={18} />
                {n}
              </button>
            )
          })}
        </nav>
        <div className="account">
          <span className="avatar">
            {user.name
              .split(' ')
              .map((s) => s[0])
              .join('')}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              if (await act('/auth/logout', {})) {
                history.replaceState(null, '', location.pathname)
                selectTab('Dashboard')
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button
            onClick={() =>
              history.state?.joinflow ? history.back() : setTab('Dashboard')
            }
          >
            ← Back
          </button>
          <span>
            Workspace <ChevronRight size={13} /> {pageTitle}
          </span>
          <button onClick={refresh}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </header>
        <div className="content">
          <div className="eyebrow">{user.role.toUpperCase()} WORKSPACE</div>
          <h1>
            {tab === 'Dashboard'
              ? user.role === 'Employee'
                ? 'Welcome, ' + user.name.split(' ')[0]
                : user.role === 'HR'
                  ? 'People overview'
                  : 'Team approvals'
              : pageTitle}
          </h1>
          <p className="subtitle">
            {user.role === 'Employee'
              ? data.job +
                ' · ' +
                data.department +
                ' · ' +
                data.location +
                ' · Starts ' +
                new Date(data.startDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
              : user.role === 'HR'
                ? 'Manage onboarding, employee changes, and HR questions.'
                : 'Review decisions and follow your team’s onboarding progress.'}
          </p>
          <Notice value={error} />
          {user.role === 'Employee' ? (
            <EmployeePortal profile={data} {...{ act, tab, busy, setTab }} />
          ) : (
            <StaffPortal {...{ user, data, tab, act, busy, setTab }} />
          )}
        </div>
      </main>
    </div>
  )
}
createRoot(document.getElementById('root')).render(<App />)
