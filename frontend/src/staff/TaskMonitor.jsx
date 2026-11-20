import React, { useState } from 'react'
import { Panel, isLate, shortDate } from '../shared/Forms'
export function TaskMonitor({
  tasks,
  filter,
  departments,
  user,
  act,
  busy,
  documents,
  plans,
  setTab,
}) {
  const hr = user.role === 'HR'
  const [scope, setScope] = useState(filter ? 'All tasks' : 'My tasks')
  const [bucket, setBucket] = useState(
    filter === 'Blocked' ? 'Critical blockers' :
    ['Overdue', 'Pending'].includes(filter) ? filter : 'All'
  )
  const [search, q] = useState(''),
    [dept, department] = useState(''),
    [owner, assignee] = useState(''),
    [state, status] = useState('')
  const [selected, select] = useState(filter || '')
  const item = tasks.find(t => t.id === selected)
  const myTasks = tasks.filter(t => t.owner.id === user.id)
  const scoped = scope === 'My tasks' ? myTasks : tasks
  const open = t => t.review === 'Approved' && t.status !== 'Complete'
  const actionable = t => open(t) && ['Available', 'In progress'].includes(t.status)
  const hasEvidence = t => !t.evidenceKind || !hr || documents?.some(
    d => d.employeeId === t.employeeId && d.kind === t.evidenceKind && d.status === 'Approved'
  )
  const next = myTasks.filter(t => actionable(t) && hasEvidence(t)).sort((a,b) =>
    Number(Boolean(isLate(b))) - Number(Boolean(isLate(a))) ||
    Number(b.status === 'In progress') - Number(a.status === 'In progress') ||
    (a.due || '9999').localeCompare(b.due || '9999')
  )[0]
  const queues = {
    'All': scoped,
    'Pending': scoped.filter(open),
    'In progress': scoped.filter(t => t.status === 'In progress'),
    'Completed': scoped.filter(t => t.status === 'Complete'),
    'Overdue': scoped.filter(t => open(t) && isLate(t)),
    'Blocked': scoped.filter(t => t.status === 'Blocked'),
    'Critical blockers': scoped.filter(t => t.required && t.status === 'Blocked'),
  }
  const visible = queues[bucket].filter(t =>
    (!state || t.status === state) && (!dept || dept === t.department) &&
    (!owner || owner === t.owner.name) && t.person.toLowerCase().includes(search.trim().toLowerCase())
  )
  function changeScope(value) {
    setScope(value)
    setBucket('All')
    q('')
    department('')
    assignee('')
    status('')
    select('')
  }
  return (
    <>
      <div className="people-overview">
        <section className="task-focus">
          <div className="eyebrow">My next action</div>
          <h2>{next?.title || 'No assigned task ready to action'}</h2>
          {next && <>
            <p>{next.person} · {next.department}{next.due && ' · Due '+shortDate(next.due)}</p>
            <button className="primary" onClick={() => select(next.id)}>
              {next.approval ? 'Review decision' : 'Open task'}
            </button>
          </>}
        </section>
        <section className="hr-queue">
          <h2>{hr ? 'HR follow-up' : 'Team follow-up'}</h2>
          {hr ? <button onClick={() => setTab(plans.length ? 'Plans|'+plans[0].id : 'Plans')}>
            <span>Plans awaiting approval</span><b>{plans.length}</b>
          </button> : <button onClick={() => setTab('Decisions')}>
            <span>Pending decisions</span><b>{myTasks.filter(t => open(t) && t.approval && !t.approval.decision).length}</b>
          </button>}
          {['Blocked','Overdue'].map(label => <button key={label} onClick={() => {
            changeScope('All tasks')
            setBucket(label)
          }}><span>{label} tasks</span><b>{tasks.filter(t => open(t) && (label === 'Blocked' ? t.status === 'Blocked' : isLate(t))).length}</b></button>)}
        </section>
      </div>
      <Panel title="Task monitoring">
      <div className="tabs" role="group" aria-label="Task scope">
        {['My tasks','All tasks'].map(value => <button key={value} className={value === scope ? 'active' : ''} aria-pressed={value === scope} onClick={() => changeScope(value)}>{value} · {value === 'My tasks' ? myTasks.length : tasks.length}</button>)}
      </div>
      <div className="tabs task-buckets" role="group" aria-label="Task queue">
        {Object.entries(queues).filter(([key]) => key !== 'Critical blockers' || bucket === key).map(([key, rows]) =>
          <button key={key} className={key === bucket ? 'active' : ''} aria-pressed={key === bucket} onClick={() => setBucket(key)}>{key} · {rows.length}</button>
        )}
      </div>      <div className="formgrid">
        <label>
          Employee
          <input value={search} onChange={(e) => q(e.target.value)} />
        </label>
        {[
          ['Department', dept, department, departments],
          [
            'Assignee',
            owner,
            assignee,
            [...new Set(tasks.map((t) => t.owner.name))],
          ],
          [
            'Status',
            state,
            status,
            [
              'Available',
              'In progress',
              'Blocked',
              'Complete',
              'Draft',
              'Accepted',
              'Rejected',
            ],
          ],
        ].map(([k, v, fn, opts]) => (
          <label key={k}>
            {k}
            <select value={v} onChange={(e) => fn(e.target.value)}>
              <option value="">All</option>
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                'Task',
                'Employee',
                'Department',
                'Assignee',
                'Due',
                'Status',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>
                  <button onClick={() => select(t.id)}>{t.title}</button>
                </td>
                <td>{t.person}</td>
                <td>{t.department}</td>
                <td>{t.owner.name}</td>
                <td>{shortDate(t.due)}</td>
                <td>{t.status}
                  {t.needs.map(n => <small className="staff-task-note" key={n.id}>Waiting for {n.title} · {n.owner}</small>)}
                  {t.approval?.decision === 'declined' && <small className="staff-task-note">Declined by {t.owner.name}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p>No tasks match these filters.</p>}
      {item && (
        <aside className="task-sheet" aria-label="Task details">
          <button onClick={() => select('')}>Close details</button>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <p>
            {item.person} · {item.department} · {item.owner.name}
          </p>
          <p>
            Due {shortDate(item.due)} · {item.status}
          </p>
          <p>
            {item.completedAt && 'Completed ' + shortDate(item.completedAt)}
          </p>
          {item.evidenceKind && <p>Required evidence · {item.evidenceKind}</p>}
          {item.needs.map((n) => (
            <p key={n.id}>
              Waiting for {n.title} · {n.owner}
            </p>
          ))}
          {item.approval?.decision === 'declined' && <p>Approval declined by {item.owner.name}.</p>}
          {hr && ['Draft','Accepted'].includes(item.review) && <button className="secondary" onClick={() => setTab('Plans|'+item.employeeId)}>Review onboarding plan</button>}
          {item.owner.id === user.id && actionable(item) && (
            item.approval ? user.role === 'Manager' && <div className="task-actions">
              {['approved','declined'].map(decision => <button key={decision} disabled={busy}
                className={decision === 'approved' ? 'primary' : 'secondary'}
                onClick={() => act('/approvals/'+item.approval.id+'/decision',{decision})}>
                {decision === 'approved' ? 'Approve' : 'Decline'}
              </button>)}
            </div> : !hasEvidence(item) ? <button className="secondary" onClick={() => setTab('Documents')}>Check required document</button> :
            <div className="task-actions">
              {item.status === 'Available' && <button disabled={busy} className="secondary" onClick={() => act('/tasks/'+item.id+'/start',{})}>Start task</button>}
              <button disabled={busy} className="primary" onClick={() => act('/tasks/'+item.id+'/complete',{})}>Mark complete</button>
            </div>
          )}          <details>
            <summary>Activity history</summary>
            {item.history.length ? (
              item.history.map((e) => (
                <p key={e.id}>
                  {shortDate(e.createdAt)} · {e.actor.name} · {e.message}
                </p>
              ))
            ) : (
              <p>No task activity recorded yet.</p>
            )}
          </details>
        </aside>
      )}
    </Panel>
    </>
  )
}
