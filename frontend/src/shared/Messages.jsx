import React, { useEffect, useState } from 'react'
import { api } from './api'
import { Panel, Form, Field } from './Forms'
import { Notice } from './ui'
export function Messages({ contacts }) {
  const [contact, setContact] = useState(contacts[0]?.id || ''),
    [messages, setMessages] = useState([]),
    [err, setErr] = useState(''),
    [version, reload] = useState(0)
  useEffect(() => {
    if (!contact) return
    let live = true
    async function load() {
      try {
        const rows = await api('/messages/' + contact)
        if (live) {
          setMessages(rows)
          setErr('')
        }
      } catch (e) {
        if (live) setErr(e.message)
      }
    }
    setMessages([])
    load()
    const timer = setInterval(load, 4000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [contact, version])
  return (
    <Panel title="Direct messages">
      {!contacts.length ? (
        <p>No contacts available.</p>
      ) : (
        <>
          <label>
            Conversation with
            <select
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            >
              {contacts.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Notice value={err} />
          <div className="conversation">
            {messages.map((m) => (
              <article className="handoff" key={m.id}>
                <strong>{m.senderName}</strong>
                <p>{m.body}</p>
                <small>{new Date(m.createdAt).toLocaleString()}</small>
              </article>
            ))}
          </div>
          <Form
            reset
            label="Send message"
            submit={async (v) => {
              await api('/messages/' + contact, v)
              reload((n) => n + 1)
            }}
          >
            <Field
              label="Message"
              name="body"
              type="textarea"
              maxLength={3000}
            />
          </Form>
        </>
      )}
    </Panel>
  )
}
