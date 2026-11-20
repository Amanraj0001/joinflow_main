import React, { useState } from 'react'
import { ArrowUpRight, CheckCircle, Clock, Laptop } from 'lucide-react'
import { Panel, shortDate } from '../shared/Forms'
import { taskGroup } from './taskQueue'

const sections = ['Your next steps', 'Waiting on', 'Ready']
const icons = [Laptop, Clock, CheckCircle]

export function EquipmentAccess({ profile, setTab }) {
  const [filter, setFilter] = useState('All')
  const items = profile.tasks.filter(task => ['Equipment', 'Workplace', 'IT'].includes(task.category))
  const grouped = Object.fromEntries(sections.map(section => [section, []]))
  for (const task of items) {
    const group = taskGroup(task, profile)
    const section = group === 'Completed tasks' ? 'Ready' : group === 'Your actions' ? 'Your next steps' : 'Waiting on'
    grouped[section].push(task)
  }
  const ready = grouped.Ready.length
  const openTask = id => setTab('My Tasks|All|' + id)

  return <div className="equipment-access">
    <section className="document-overview">
      <div>
        <h2>Equipment and access readiness</h2>
        <p>{items.length ? `${ready} of ${items.length} setup steps complete` : 'No equipment or access steps assigned yet.'}</p>
      </div>
      <div className="document-progress">
        <progress aria-label="Equipment and access steps complete" value={ready} max={items.length || 1}/>
      </div>
    </section>
    {!!items.length && <>
      <div className="tabs" role="group" aria-label="Filter equipment and access">
        {['All', ...sections].map(name => <button key={name} aria-pressed={filter === name}
          className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>
          {name} · {name === 'All' ? items.length : grouped[name].length}
        </button>)}
      </div>
      {sections.map((section, index) => {
        if (filter !== 'All' && filter !== section) return null
        const rows = grouped[section]
        if (!rows.length && filter === 'All') return null
        const Icon = icons[index]
        return <Panel key={section} title={section}>
          {!rows.length && <p>{['No setup steps need your action.', 'No outstanding handoffs.', 'No setup steps completed yet.'][index]}</p>}
          {rows.map(task => <article className="access-item" key={task.id}>
            <Icon size={19} aria-hidden="true"/>
            <div>
              <h3>{task.title}</h3>
              <small>{task.department} · {task.owner.id === profile.userId ? 'Assigned to you' : task.owner.name}
                {task.status !== 'Complete' && task.due && ' · Due ' + shortDate(task.due)}</small>
              {section === 'Ready' ? <p>{task.approval?.decision === 'approved' ? 'Approved' : 'Completed'}{task.completedAt && ' · ' + shortDate(task.completedAt)}</p>
                : section === 'Your next steps' ? <p>{task.description}</p>
                : <>
                  {task.needs.map(need => <div className="access-dependency" key={need.id}>
                    Waiting for <strong>{need.owner}</strong> to complete <button onClick={() => openTask(need.id)}>{need.title}</button>
                  </div>)}
                  {task.approval?.decision === 'declined' && <p>Approval declined. Follow up with {task.owner.name} or HR.</p>}
                  {!task.needs.length && task.approval?.decision !== 'declined' && <p>
                    {taskGroup(task, profile) === 'Waiting for review' ? 'Waiting for HR to review your ' + task.evidenceKind + '.'
                      : 'Waiting for ' + task.owner.name + (task.approval ? ' to review this request.' : ' to finish this step.')}
                  </p>}
                </>}
              <button className="access-open" onClick={() => openTask(task.id)}>
                {section === 'Your next steps' ? 'Open task' : 'View task details'} <ArrowUpRight size={14}/>
              </button>
            </div>
          </article>)}
        </Panel>
      })}
    </>}
  </div>
}
