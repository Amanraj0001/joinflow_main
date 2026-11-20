import React, { useState } from 'react'
import { Panel, Field, Form, shortDate } from '../shared/Forms'
import { Change } from './Team'
export function EmployeeDirectory({ people, filter, soon, act, busy, hr }) {
  const [search, q] = useState(''),
    [person, choose] = useState(filter || '')
  const list = people.filter(
      (p) =>
        (filter === 'Joining soon'
          ? soon(p)
          : filter === 'Active'
            ? !p.readiness.ready
            : filter === 'Ready'
              ? p.readiness.ready
              : true) &&
        [p.user.name, p.department, p.location, p.job]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    p = list.find((x) => x.id === person) || list[0]
  return (
    <Panel
      title={
        people.some((p) => p.id === filter)
          ? 'Employee directory'
          : filter || 'Employee directory'
      }
    >
      <label>
        Search by name, role, department or office
        <input value={search} onChange={(e) => q(e.target.value)} />
      </label>
      {p ? (
        <>
          <label>
            Employee
            <select value={p.id} onChange={(e) => choose(e.target.value)}>
              {list.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.user.name}
                </option>
              ))}
            </select>
          </label>
          <h3>{p.user.name}</h3>
          <p>
            {p.job} · {p.department} · {p.location} · {shortDate(p.startDate)} ·
            Manager {p.manager.name}
          </p>
          <p>
            {p.readiness.complete}/{p.readiness.total} required tasks complete ·{' '}
            {p.plan}
          </p>
          {hr && (
            <>
              <Change key={p.id + p.version} {...{ p, act, busy }} />
              <details key={p.id}>
                <summary>Edit profile</summary>
                <Form submit={(v) => act('/employees/' + p.id + '/profile', v)}>
                  <Field name="name" label="Full name" value={p.user.name} />
                  <Field
                    name="department"
                    label="Department"
                    value={p.department}
                  />
                  <Field
                    name="personalEmail"
                    type="email"
                    label="Personal email"
                    value={p.personalEmail}
                  />
                  <Field
                    name="startDate"
                    label="Joining date"
                    type="date"
                    value={p.startDate.slice(0, 10)}
                  />
                </Form>
              </details>
              {p.personalEmail && (
                <button
                  onClick={() => act('/employees/' + p.id + '/invite', {})}
                >
                  Resend account setup email
                </button>
              )}
            </>
          )}
          {p.tasks.map((t) => (
            <p key={t.id}>
              {t.title} · {t.status}
            </p>
          ))}
        </>
      ) : (
        <p>No matching employees.</p>
      )}
    </Panel>
  )
}
