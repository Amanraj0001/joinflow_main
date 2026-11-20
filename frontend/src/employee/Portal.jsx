import React, { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Panel, shortDate, isLate } from '../shared/Forms'
import { Tickets } from '../shared/Tickets'
import { Chat } from './Assistant'
import { Employee } from './Employee'
import { Documents } from './Documents'
import { EquipmentAccess } from './EquipmentAccess'
import { personalQueue } from './taskQueue'
export function EmployeePortal({ profile: p, tab, act, busy, setTab }) {
  const [filter, setFilter] = useState('Unread')
  const [page, target] = tab.split('|')
  const tasks = p.tasks,
    complete = tasks.filter((t) => t.status === 'Complete').length,
    next = personalQueue(p)[0]
  const notices = p.notifications || [],
    deadline = tasks
      .filter((t) => t.due && t.status !== 'Complete')
      .sort((a, b) => a.due.localeCompare(b.due))
  const navigate = (name, label) => (
    <button className="secondary" onClick={() => setTab(name)}>
      {label || name}
    </button>
  )
  if (tab.split('|')[0] === 'My Tasks')
    return (
      <Employee
        key={tab}
        setTab={setTab}
        target={tab.split('|')[2]}
        initialFilter={tab.split('|')[1]}
        profile={p}
        {...{ tab, act, busy }}
      />
    )
  if (tab === 'AI Assistant') return <Chat />
  if (tab === 'My Profile')
    return (
      <Panel title={p.user.name}>
        <p>
          {p.job} · {p.department}
        </p>
        <p>Work email · {p.user.email}</p>
        <p>Personal email · {p.personalEmail || 'Awaiting HR update'}</p>
        <p>Office · {p.location}</p>
        <p>Joining date · {shortDate(p.startDate)}</p>
        <p>Reporting manager · {p.manager.name}</p>
      </Panel>
    )
  if (page === 'My Documents') return <Documents profile={p} target={target} act={act} />
  if (tab === 'Equipment & Access')
    return <EquipmentAccess profile={p} setTab={setTab} />
  if (tab === 'Notifications')
    return (
      <Panel title="Updates and reminders">
        <div className="tabs">
          {['Unread', 'Read', 'All'].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === 'Unread' && ' · ' + notices.filter((n) => !n.read).length}
            </button>
          ))}
        </div>
        <button
          disabled={busy || !notices.some((n) => !n.read)}
          onClick={() => act('/notifications/read-all', {})}
        >
          Mark all as read
        </button>
        {!notices.some(
          (n) => filter === 'All' || n.read === (filter === 'Read'),
        ) && <p>No {filter.toLowerCase()} notifications.</p>}
        {notices
          .filter((n) => filter === 'All' || n.read === (filter === 'Read'))
          .map((n) => (
            <article key={n.id} className="decision">
              <div>
                <button
                  className="link"
                  onClick={async () => {
                    const [type, id] = n.key.split(':')
                    if (
                      !n.read &&
                      !(await act('/notifications/' + n.id + '/read', {}))
                    )
                      return
                    setTab(
                      type === 'document'
                        ? 'My Documents|' + id
                        : type === 'issue'
                          ? 'Help & Support|' + id
                          : type === 'message'
                            ? 'Help & Support|Messages'
                            : 'My Tasks|All|' + id,
                    )
                  }}
                >
                  {n.body}
                </button>
                <small>
                  {new Date(n.createdAt).toLocaleString()} ·{' '}
                  {n.read ? 'Read' : 'Unread'}
                </small>
              </div>
              {!n.read && (
                <button
                  onClick={() => act('/notifications/' + n.id + '/read', {})}
                >
                  Mark read
                </button>
              )}
            </article>
          ))}
      </Panel>
    )
  if (page === 'Help & Support')
    return (
      <Tickets
        key={target}
        target={target}
        issues={p.issues}
        handoffs={p.handoffs}
        contacts={p.contacts}
        act={act}
        busy={busy}
      />
    )
  return (
    <>
      <div className="people-overview">
        <section className="hire-overview">
          <h2>My onboarding progress</h2>
          <button className="active-hire-link" onClick={() => setTab('My Tasks')}>
            <strong>{tasks.length ? Math.round(100 * complete / tasks.length) + '%' : '—'}</strong>
            Open checklist <ArrowUpRight size={18} />
          </button>
          <div className="readiness-caption">
            <span>{p.plan === 'Draft' ? 'Plan awaiting HR approval' : p.readiness.ready ? 'Ready for day one' : 'Tasks completed'}</span>
            <span>{complete} of {tasks.length}</span>
          </div>
          <progress aria-label="Overall onboarding progress" value={complete} max={tasks.length || 1} />
          <div className="hire-links">
            {[
              ['Completed', complete, 'Complete'],
              ['Pending', tasks.length - complete, 'Pending'],
              ['Overdue', tasks.filter(isLate).length, 'Overdue'],
            ].map(([label, count, filter]) => (
              <button key={filter} onClick={() => setTab('My Tasks|' + filter)}>
                <strong>{count}</strong>{label}
              </button>
            ))}
          </div>
        </section>
        <section className="employee-next">
          <h2>Next action</h2>
          <p className="recommended">{next?.title || 'No available task right now.'}</p>
          {next && <small>{next.department} · {next.due ? 'Due ' + shortDate(next.due) : 'No deadline'}</small>}
          <div className="overview-actions">
            {next && navigate('My Tasks|All|' + next.id, 'View task')}
            {navigate('AI Assistant', 'Ask the assistant')}
          </div>
        </section>
      </div>
      <div className="overview-details">
        <Panel title="Upcoming deadlines">
          {deadline
            .filter((t) => !isLate(t))
            .slice(0, 5)
            .map((t) => (
              <p className="timeline-row" key={t.id}>
                <strong>{t.title}</strong>
                <small>
                  {shortDate(t.due)} · {t.owner.name}
                </small>
              </p>
            ))}
          {!deadline.some((t) => !isLate(t)) && <p>No upcoming deadlines.</p>}
        </Panel>
      <Panel title="Recent notifications">
        {!notices.length && <p>No updates yet.</p>}
        {notices.slice(0, 3).map((n) => (
          <p className="timeline-row" key={n.id}>
            {n.body}
            <small>{shortDate(n.createdAt)}</small>
          </p>
        ))}
        {navigate('Notifications', 'View all updates')}
      </Panel>
      </div>
    </>
  )
}
