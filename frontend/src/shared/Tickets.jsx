import React, { useState } from 'react'
import { Panel, Form, Field, file64 } from './Forms'
import { Messages } from './Messages'
import { Handoffs } from './Handoffs'

const statuses = [
  'Open',
  'In progress',
  'Waiting for Employee',
  'Waiting for Department',
  'Escalated',
  'Resolved',
  'Closed',
]
const time = (v) => new Date(v).toLocaleString()
export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button
          key={item}
          aria-pressed={value === item}
          className={value === item ? 'active' : ''}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
export function Tickets({
  issues = [],
  handoffs = [],
  people = [],
  contacts = [],
  act,
  busy,
  staff,
  department,
  target,
  issuesOnly = false,
}) {
  const home = staff ? 'Requests' : 'My Requests'
  const [tab, setTab] = useState(target === 'Messages' ? 'Messages' : home)
  const [selected, select] = useState(target || '')
  const [filter, setFilter] = useState('All')
  const [confirmation, confirm] = useState('')
  const rows = [
    ...issues.map((i) => ({
      ...i,
      subject: i.category,
      latest: i.updates.at(-1)?.at || i.createdAt,
    })),
    ...handoffs.map((h) => ({
      ...h,
      handoff: true,
      subject: h.question,
      status: h.answeredAt ? 'Resolved' : 'Open',
      priority: 'Normal',
      latest: h.answeredAt || h.createdAt,
    })),
  ]
    .filter((i) => filter === 'All' || i.status === filter)
    .sort((a, b) => b.latest.localeCompare(a.latest))
  const current = rows.find((i) => i.id === selected)
  const name = (i) =>
    people.find((p) => p.id === i.employeeId)?.user.name ||
    i.employee?.user.name
  async function create({ attachment, ...v }) {
    const result = await act('/issues', {
      ...v,
      ...(attachment?.size
        ? { file: await file64(attachment), filename: attachment.name }
        : {}),
    })
    if (result) {
      confirm('Request created. Ticket ' + result.id)
      select(result.id)
      setFilter('All')
      setTab(home)
    }
    return result
  }
  return (
    <>
      {!issuesOnly && (
        <Tabs
          items={[home, ...(staff ? [] : ['New Request']), 'Messages']}
          value={tab}
          onChange={setTab}
        />
      )}
      {confirmation && <p role="status">{confirmation}</p>}
      {tab === 'Messages' ? (
        <Messages contacts={contacts} />
      ) : tab === 'New Request' ? (
        <Panel title="Raise an onboarding issue">
          <Form label="Create request" submit={create}>
            <Field
              label="Category"
              name="category"
              options={[
                'Laptop not received',
                'Document upload',
                'Company email',
                'Access permissions',
                'Payroll',
                'Other',
              ]}
            />
            <Field
              label="Description"
              name="description"
              type="textarea"
              maxLength={3000}
            />
            <Field
              label="PDF attachment (optional)"
              name="attachment"
              type="file"
              accept="application/pdf"
              required={false}
            />
          </Form>
        </Panel>
      ) : (
        <div className={'inbox ' + (current ? 'selected' : '')}>
          <section className="panel ticket-list">
            <h2>{home}</h2>
            <label>
              Filter by status
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value)
                  select('')
                }}
              >
                {['All', ...statuses].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {!rows.length && <p>No matching requests.</p>}
            {rows.map((i) => (
              <button
                key={i.id}
                aria-pressed={i.id === selected}
                onClick={() => select(i.id)}
              >
                <strong>
                  {name(i)} {i.subject}
                </strong>
                <small>
                  #{i.id} · {time(i.latest)}
                </small>
                <small>
                  {i.status} · {i.priority}
                </small>
              </button>
            ))}
          </section>
          <section className="panel ticket-detail">
            {current ? (
              <>
                <button onClick={() => select('')}>Back to requests</button>
                {current.handoff ? (
                  <Handoffs
                    items={[current]}
                    people={people}
                    act={staff ? act : undefined}
                    busy={busy}
                  />
                ) : (
                  <React.Fragment key={current.id}>
                    <h2>{current.category}</h2>
                    <small>
                      #{current.id} · {current.status} · {current.department} ·{' '}
                      {current.priority}
                    </small>
                    <div className="conversation">
                      <article className="handoff">
                        <strong>{name(current) || 'You'}</strong>
                        <small>{time(current.createdAt)}</small>
                        <p>{current.description}</p>
                        {current.filename && (
                          <a href={'/api/issues/' + current.id + '/attachment'}>
                            Download {current.filename}
                          </a>
                        )}
                      </article>
                      {current.updates.map((u, n) => (
                        <article key={n} className="handoff">
                          <strong>{u.author}</strong>
                          <small>{time(u.at)}</small>
                          <p>{u.body}</p>
                        </article>
                      ))}
                    </div>
                    {staff && current.triage && (
                      <p>
                        AI routing suggestion · {current.triage.department} ·{' '}
                        {current.triage.reason}
                      </p>
                    )}
                    {(staff ||
                      !['Closed', 'Resolved'].includes(current.status)) && (
                      <Form
                        reset
                        label={staff ? 'Update issue' : 'Send reply'}
                        submit={(v) =>
                          act(
                            '/issues/' +
                              current.id +
                              (staff ? '/update' : '/reply'),
                            v,
                          )
                        }
                      >
                        {staff && (
                          <div className="formgrid">
                            <Field
                              label="Route to"
                              name="department"
                              value={current.department}
                              options={
                                department
                                  ? [department]
                                  : ['IT', 'People', 'Finance', 'Facilities']
                              }
                            />
                            <Field
                              name="status"
                              label="Issue status"
                              value={current.status}
                              options={statuses}
                            />
                          </div>
                        )}
                        <Field
                          label="Response"
                          name="body"
                          type="textarea"
                          maxLength={2000}
                        />
                      </Form>
                    )}
                    {staff && !department && (
                      <details>
                        <summary>Internal HR notes</summary>
                        {current.internalNotes?.map((n, i) => (
                          <p key={i}>
                            {n.author} · {time(n.at)} · {n.body}
                          </p>
                        ))}
                        <Form
                          reset
                          label="Save internal note"
                          submit={(v) =>
                            act('/issues/' + current.id + '/note', v)
                          }
                        >
                          <Field
                            label="Note visible to HR"
                            name="body"
                            type="textarea"
                            maxLength={2000}
                          />
                        </Form>
                      </details>
                    )}
                  </React.Fragment>
                )}
              </>
            ) : (
              <p>Select a request to see its conversation.</p>
            )}
          </section>
        </div>
      )}
    </>
  )
}
