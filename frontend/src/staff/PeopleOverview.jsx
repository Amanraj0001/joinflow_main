import React from 'react'
import { ArrowUpRight } from 'lucide-react'

export function PeopleOverview({ people, joining, attention, queues, team, setTab }) {
  const ready = people.filter((person) => person.readiness.ready).length
  const total = people.length

  return (
    <div className="people-overview">
      <section className="hire-overview">
        <h2>{team ? 'Team readiness' : 'Onboarding readiness'}</h2>
        <button className="active-hire-link" onClick={() => setTab('Employees|Active')}>
          <strong>{total - ready}</strong> Active hires <ArrowUpRight size={18} />
        </button>
        <div className="readiness-caption">
          <button onClick={() => setTab('Employees|Ready')}>Day-one ready <ArrowUpRight size={14} /></button>
          <span>{ready} of {total}</span>
        </div>
        <progress aria-label="Hires ready for day one" value={ready} max={total || 1} />
        <div className="hire-links">
          <button onClick={() => setTab('Employees|Joining soon')}><strong>{joining}</strong> Joining soon</button>
          <button onClick={() => setTab('Escalations')}><strong>{attention}</strong> Requires attention</button>
        </div>
      </section>
      <section className="hr-queue">
        <h2>{team ? 'Manager work queue' : 'HR work queue'}</h2>
        {queues.map(([label, count, destination]) => (
          <button key={destination} onClick={() => setTab(destination)}>
            <span>{label}</span>
            <b className={count && ['Tasks|Blocked', 'Tasks|Overdue'].includes(destination) ? 'needs-action' : ''}>{count}</b>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        ))}
      </section>
    </div>
  )
}
