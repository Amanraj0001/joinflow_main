import React, { useState } from 'react'
import { Check, ChevronDown, ClipboardList, Compass, LockKeyhole } from 'lucide-react'
import { isLate, shortDate } from '../shared/Forms'
import { Pill } from '../shared/ui'
import { evidenceFor, personalQueue, taskGroup } from './taskQueue'

const groups = ['Your actions', 'Blocked', 'Waiting for review', 'Assigned to others', 'Completed tasks']
const filters = ['All', 'Day one', 'Available', 'Blocked', 'In progress', 'Complete', 'Pending', 'Overdue']

export function Employee({ profile, initialFilter, target, setTab, act, busy }) {
  const [filter, setFilter] = useState(initialFilter || 'All')
  const [open, setOpen] = useState(target || null)
  const { tasks, readiness } = profile
  const mine = personalQueue(profile)
  const next = mine[0]
  const blocked = tasks.filter(t => t.status === 'Blocked')

  function matches(task) {
    if (filter === 'Pending') return task.status !== 'Complete'
    if (filter === 'Overdue') return isLate(task)
    if (filter === 'Day one') return readiness.remaining.includes(task.id)
    return filter === 'All' || task.status === filter
  }

  function action(task, featured = false) {
    const evidence = evidenceFor(task, profile)
    if (task.completionMethod === 'Evidence' && evidence?.status !== 'Approved')
      return <button className="primary" onClick={() => setTab('My Documents')}>
        {evidence ? 'Replace document' : 'Submit document'}
      </button>
    if (featured && task.status === 'Available')
      return <button className="primary" disabled={busy} onClick={() => act('/tasks/' + task.id + '/start', {})}>Start task</button>
    return <button className="primary" disabled={busy} onClick={() => act('/tasks/' + task.id + '/complete', {})}>Mark complete <Check size={15}/></button>
  }

  function renderTask(task) {
    const group = taskGroup(task, profile)
    const expanded = open === task.id
    return <article className="task" key={task.id}>
      <button className="taskrow" aria-expanded={expanded} aria-controls={expanded ? 'detail-'+task.id : undefined}
        onClick={() => setOpen(expanded ? null : task.id)}>
        <span className={'taskicon '+task.status.toLowerCase()}>
          {task.status === 'Complete' ? <Check/> : task.status === 'Blocked' ? <LockKeyhole/> : <ClipboardList/>}
        </span>
        <span className="taskname">
          <strong>{task.title}</strong>
          <small>{task.owner.id === profile.userId ? 'Assigned to you' : task.owner.name}
            {task.due && ' · '+(isLate(task) ? 'Overdue since ' : 'Due ')+shortDate(task.due)}</small>
          {task.needs.map(n => <small className="dependency-note" key={n.id}>Waiting for {n.title} · {n.owner}</small>)}
          {task.approval?.decision === 'declined' && <small className="dependency-note">Approval declined · Contact {task.owner.name} or HR</small>}
          {group === 'Waiting for review' && <small>{task.evidenceKind} submitted · Awaiting HR review</small>}
        </span>
        <Pill value={group === 'Waiting for review' ? 'Under review' : task.status}/>
        <ChevronDown size={15} className={expanded ? 'turned' : ''}/>
      </button>
      {expanded && <div id={'detail-'+task.id} className="taskdetail">
        <p>{task.description}</p>
        <small>{task.category} · {task.completionMethod} completion · {task.required ? 'Required' : 'Optional'} for day one</small>
        {group === 'Your actions' && <div className="task-actions">
          {task.status === 'Available' && task.completionMethod !== 'Evidence' && <button className="secondary" disabled={busy} onClick={() => act('/tasks/'+task.id+'/start',{})}>Start task</button>}
          {action(task)}
        </div>}
        {group === 'Waiting for review' && <button onClick={() => setTab('My Documents')}>View submission</button>}
      </div>}
    </article>
  }

  return <div className="employee-tasks">
    <div className="people-overview">
      <section className="task-focus">
        <div className="eyebrow"><Compass size={16}/> Next action</div>
        <h2>{next?.title || (profile.plan === 'Draft' ? 'HR is reviewing your plan' : 'No action needed from you')}</h2>
        {next && <><p>{next.description}</p>
          <small>{next.status}{next.due && ' · Due '+shortDate(next.due)}</small>
          {action(next,true)}</>}
      </section>
      <section className="task-readiness">
        <h2>Day-one readiness</h2>
        <p><strong>{readiness.complete} of {readiness.total}</strong> required tasks complete</p>
        <progress aria-label="Day-one readiness" value={readiness.complete} max={readiness.total || 1}/>
        <button className="task-block-link" onClick={() => {
          setFilter('Blocked')
          document.getElementById('task-list-title')?.focus()
        }}><LockKeyhole size={16}/> {blocked.length} blocked {blocked.length === 1 ? 'task' : 'tasks'} <span>View blockers →</span></button>
      </section>
    </div>
    <section className="panel">
      <h2 id="task-list-title" tabIndex={-1}>My checklist</h2>
      <div className="tabs" aria-label="Filter tasks">
        {filters.map(f => <button key={f} className={filter === f ? 'active' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      {groups.map(group => {
        const list = (group === 'Your actions' ? mine : tasks.filter(t => taskGroup(t,profile) === group)).filter(matches)
        if (!list.length) return null
        if (group === 'Completed tasks') return <details key={group} open={filter === 'Complete' || list.some(t => t.id === target)}>
          <summary>{group} ({list.length})</summary>{list.map(renderTask)}</details>
        return <section className="task-group" key={group}><h3>{group} <span>{list.length}</span></h3>{list.map(renderTask)}</section>
      })}
      {!tasks.some(matches) && <p>{filter === 'All' ? 'No tasks assigned yet.' : 'No matching tasks.'}</p>}
    </section>
  </div>
}
