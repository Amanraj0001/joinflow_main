import React from 'react'
import { Clock3, Layers3 } from 'lucide-react'
export function Brand() {
  return (
    <div className="brand">
      <span className="brandmark">
        <Layers3 size={23} />
      </span>
      JoinFlow
    </div>
  )
}
export function Notice({ value }) {
  return (
    value && (
      <div role="alert" className="notice">
        {value}
      </div>
    )
  )
}
export function Pill({ value }) {
  return <span className={'pill ' + value.toLowerCase()}>{value}</span>
}
export function History({ events }) {
  return (
    <section className="panel">
      <h2>Activity</h2>
      {events.map((e) => (
        <div className="event" key={e.id}>
          <Clock3 size={16} />
          <div>
            {e.message}
            <small>
              {e.actor.name} · {new Date(e.createdAt).toLocaleString()}
            </small>
          </div>
        </div>
      ))}
    </section>
  )
}
