import React from 'react'

export function Handoffs({ items, people, act, busy }) {
  return (
    <section className="panel">
      <h2>{act ? 'Questions for HR' : 'My questions'}</h2>
      {!items.length && (
        <p>
          {act
            ? 'Employee questions sent to HR will appear here.'
            : 'Questions you send from the assistant will appear here with HR’s replies.'}
        </p>
      )}
      {items.map((item) => (
        <article key={item.id} className="handoff">
          {people && (
            <strong>
              {people.find((p) => p.id === item.employeeId)?.user.name}
            </strong>
          )}
          <p>{item.question}</p>
          <small>
            {new Date(item.createdAt).toLocaleString()} ·{' '}
            {item.answeredAt ? 'Answered' : 'Awaiting HR reply'}
          </small>
          {item.answeredAt ? (
            <blockquote>
              <strong>{item.answeredBy}</strong>
              <p>{item.answer}</p>
              <small>{new Date(item.answeredAt).toLocaleString()}</small>
            </blockquote>
          ) : (
            act && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const answer = new FormData(e.currentTarget)
                    .get('answer')
                    .trim()
                  if (answer) act('/handoffs/' + item.id + '/reply', { answer })
                }}
              >
                <label>
                  Reply to employee
                  <textarea name="answer" required maxLength={4000} rows={3} />
                </label>
                <button className="primary" disabled={busy}>
                  Send reply
                </button>
              </form>
            )
          )}
        </article>
      ))}
    </section>
  )
}
