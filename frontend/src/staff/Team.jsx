import React, { useState } from 'react'
import { ArrowRight, MapPin, Users } from 'lucide-react'
import { api } from '../shared/api.js'
import { Handoffs } from '../shared/Handoffs.jsx'
import { History, Notice, Pill } from '../shared/ui.jsx'
export function NewHire({ managers, roles, act, busy, setTab }) {
  async function submit(e) {
    e.preventDefault()
    const employee = await act(
      '/employees',
      Object.fromEntries(new FormData(e.currentTarget))
    )
    if (employee) setTab('Plans|' + employee.id)
  }
  return (
    <form className="panel hireform" onSubmit={submit}>
      <h2>Create employee profile</h2>
      <div className="formgrid">
        {[
          ['Full name', 'name', 'text'],
          ['Work email', 'email', 'email'],
          ['Personal email', 'personalEmail', 'email'],
          ['Department', 'department', 'text'],
          ['Start date', 'startDate', 'date'],
        ].map(([label, name, type]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              type={type}
              minLength={name === 'password' ? 10 : 1}
              required
            />
          </label>
        ))}
        {[
          ['Job role', 'job', roles.map((r) => r.name)],
          ['Office', 'location', ['London', 'Austin']],
        ].map(([label, name, opts]) => (
          <label key={name}>
            {label}
            <select name={name}>
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Manager
          <select name="managerId" required>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={busy} className="primary">
        Create checklist <ArrowRight size={16} />
      </button>
    </form>
  )
}
export function Change({ p, act, busy }) {
  const [delta, setDelta] = useState(null),
    [err, setErr] = useState(''),
    [loading, setLoading] = useState(false)
  const target = p.location === 'London' ? 'Austin' : 'London'
  async function review() {
    setLoading(true)
    setErr('')
    try {
      setDelta(
        await api('/employees/' + p.id + '/change-preview', {
          location: target,
        })
      )
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="change">
      <button className="secondary" disabled={loading} onClick={review}>
        <MapPin size={14} />
        Preview move to {target}
      </button>
      <Notice value={err} />
      {delta && (
        <div className="changebox">
          <h3>Move to {delta.location}</h3>
          {['added', 'removed', 'retained'].map((k) => (
            <div key={k}>
              <strong>{k}</strong>
              <p>{delta[k].map((t) => t.title).join(', ') || 'None'}</p>
            </div>
          ))}
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act('/employees/' + p.id + '/apply-change', {
                    location: delta.location,
                    version: delta.version,
                  })
                )
                  setDelta(null)
              }}
            >
              Apply change
            </button>
            <button className="secondary" onClick={() => setDelta(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export function Decisions({ data, act, busy }) {
  const pending = data.people.flatMap((p) =>
    p.tasks
      .filter((t) => t.approval && !t.approval.decision)
      .map((t) => ({ ...t, person: p.user.name }))
  )
  return (
    <section className="panel">
      <h2>Pending decisions</h2>
      {pending.length ? (
        pending.map((t) => (
          <div className="decision" key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <small>
                {t.person} · {t.category}
              </small>
            </div>
            <div className="actions">
              {['approved', 'declined'].map((d) => (
                <button
                  className={d === 'approved' ? 'primary' : 'secondary'}
                  disabled={busy}
                  key={d}
                  onClick={() =>
                    act('/approvals/' + t.approval.id + '/decision', {
                      decision: d,
                    })
                  }
                >
                  {d === 'approved' ? 'Approve' : 'Decline'}
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p>All decisions reviewed.</p>
      )}
    </section>
  )
}
