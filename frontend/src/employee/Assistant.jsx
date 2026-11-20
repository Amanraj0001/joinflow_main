import React, { useEffect, useState, useRef } from 'react'
import { api } from '../shared/api.js'
import { Notice } from '../shared/ui.jsx'
import { Sparkles, ArrowUpRight, ArrowRight, BookOpen } from 'lucide-react'
export function Chat() {
  const [question, setQuestion] = useState(''),
    [messages, setMessages] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const bottom = useRef(null)
  useEffect(() => {
    let live = true
    api('/chat')
      .then((rows) => {
        if (live) setMessages(rows)
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (bottom.current) bottom.current.scrollTop = bottom.current.scrollHeight
  }, [messages, busy])
  async function ask(q) {
    if (!q.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const answer = await api('/chat', { question: q })
      setMessages((m) => [...m, { question: q, ...answer }])
      setQuestion('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function handoff(m, i) {
    if (!window.confirm('Send this question to HR for a reply?')) return
    setBusy(true)
    try {
      await api('/handoffs', { question: m.question, turnId: m.id })
      setMessages((ms) =>
        ms.map((x, n) => (i === n ? { ...x, sent: true } : x)),
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel chat">
      <div className="secthead">
        <div className="iconbox">
          <Sparkles size={20} />
        </div>
        <div>
          <h2>Onboarding assistant</h2>
          <small>Answers from your checklist and approved policies</small>
        </div>
      </div>
      {!loading && !messages.length && (
        <div className="chips">
          {['What is blocked?', 'When do benefits begin?'].map((q) => (
            <button disabled={busy} key={q} onClick={() => ask(q)}>
              {q}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      )}
      <div className="conversation" ref={bottom} aria-live="polite">
        {loading && <p>Loading conversation…</p>}
        {messages.map((m, i) => (
          <article className="response" key={i}>
            <h3>{m.question}</h3>
            <p>{m.text}</p>
            {m.evidence.map((e) => (
              <details key={e.id}>
                <summary>
                  <BookOpen size={14} /> {e.title}
                </summary>
                <p>
                  {e.body} {e.version && '· Policy v' + e.version}
                </p>
              </details>
            ))}
            {m.escalate && i === messages.length - 1 && (
              <button
                className="secondary"
                disabled={busy || m.sent}
                onClick={() => handoff(m, i)}
              >
                {m.sent ? 'Sent to HR' : 'Send question to HR'}
              </button>
            )}
          </article>
        ))}
        {busy && <small role="status">Working…</small>}
      </div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
      >
        <input
          aria-label="Ask a question"
          placeholder="Ask an onboarding question…"
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          aria-label="Send question"
          disabled={loading || busy || !question.trim()}
          className="primary"
        >
          <ArrowRight size={17} />
        </button>
      </form>
      <Notice value={error} />
    </section>
  )
}
