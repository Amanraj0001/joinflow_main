import React, { useState } from 'react'
import { Panel, shortDate, isLate } from '../shared/Forms'
import { Tickets, Tabs } from '../shared/Tickets'
export function Escalations({
  data,
  people,
  risk,
  late,
  blocked,
  hr,
  user,
  act,
  setTab,
}) {
  const [tab, select] = useState('At-risk Employees')
  const delayed = [
    ...new Map([...late, ...blocked].map((t) => [t.id, t])).values(),
  ]
  return (
    <>
      <Tabs
        value={tab}
        onChange={select}
        items={['At-risk Employees', 'Delayed Tasks', 'Support Issues']}
      />
      {tab === 'Support Issues' ? (
        <Tickets
          staff
          issuesOnly
          issues={data.issues}
          people={people}
          department={hr ? null : user.department}
          act={act}
        />
      ) : (
        <Panel title={tab}>
          {tab === 'At-risk Employees' ? (
            <>
              {people.filter(risk).map((p) => {
                const open = p.tasks.filter(
                  (t) =>
                    t.required &&
                    t.review === 'Approved' &&
                    t.status !== 'Complete',
                )
                const critical = open.filter(
                  (t) => isLate(t) || t.status === 'Blocked',
                )
                return (
                  <article className="handoff" key={p.id}>
                    <strong>{p.user.name}</strong>
                    <small>
                      Joins {shortDate(p.startDate)} ·{' '}
                      {critical.length ? 'High risk' : 'Approaching start date'}{' '}
                      · {open.length} requirements open
                    </small>
                    <p>
                      {(critical.length ? critical : open)
                        .map((t) => t.title)
                        .join(' · ') || 'Onboarding plan awaits approval'}
                    </p>
                    <button onClick={() => setTab('Employees|' + p.id)}>
                      View employee
                    </button>
                  </article>
                )
              })}
              {!people.some(risk) && <p>No employees currently at risk.</p>}
            </>
          ) : (
            <>
              {delayed.map((t) => (
                <article className="handoff" key={t.id}>
                  <strong>
                    {t.title} · {t.person}
                  </strong>
                  <small>
                    {t.department} · {t.owner.name} · Due {shortDate(t.due)} ·{' '}
                    {t.status}
                  </small>
                  <p>
                    {t.needs.map((n) => n.title).join(', ') ||
                      (t.approval?.decision === 'declined'
                        ? 'Approval declined'
                        : 'Due date passed')}
                  </p>
                  <button onClick={() => setTab('Tasks|' + t.id)}>
                    Investigate task
                  </button>
                  {hr && (
                    <button onClick={() => setTab('Plans|' + t.employeeId)}>
                      Assign follow-up step
                    </button>
                  )}
                </article>
              ))}
              {!delayed.length && <p>No delayed tasks.</p>}
            </>
          )}
        </Panel>
      )}
    </>
  )
}
