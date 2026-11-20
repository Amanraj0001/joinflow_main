import React, { useState } from 'react'
import { Panel, Field, Form } from '../shared/Forms'
export function StaffAccess({ data, act }) {
  return (
    <>
      <Panel title="Staff registrations">
        {!data.registrations.length && (
          <p>No registrations awaiting verification.</p>
        )}
        {data.registrations.map((r) => (
          <article key={r.id} className="decision">
            <span>
              {r.name} · {r.email} · {r.role} · {r.department}
            </span>
            {['Approve', 'Reject'].map((decision) => (
              <button
                key={decision}
                onClick={() => act('/registrations/' + r.id, { decision })}
              >
                {decision}
              </button>
            ))}
          </article>
        ))}
      </Panel>
      <Panel title="Job roles">
        {data.roles.map((r) => (
          <details key={r.name}>
            <summary>{r.name}</summary>
            <p>{r.steps.join(' · ')}</p>
          </details>
        ))}
        <Form
          reset
          label="Create job role"
          submit={(v) =>
            act('/roles', {
              name: v.name,
              steps: v.steps
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          <Field label="Role name" name="name" />
          <Field
            label="Role-specific steps (one per line)"
            type="textarea"
            name="steps"
          />
        </Form>
      </Panel>
    </>
  )
}
