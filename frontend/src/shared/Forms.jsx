import React, { useState } from 'react'
import { Notice } from './ui'
export function Field({
  label,
  name,
  options,
  type = 'text',
  required = true,
  value,
  ...rest
}) {
  return (
    <label>
      {label}
      {options ? (
        <select name={name} defaultValue={value} required={required} {...rest}>
          {options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o]
            return (
              <option value={v} key={v}>
                {l}
              </option>
            )
          })}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          {...rest}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          {...rest}
        />
      )}
    </label>
  )
}
export function Form({ children, submit, label = 'Save', reset = false }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  return (
    <form
      className="portalform"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        setBusy(true)
        setError('')
        try {
          const ok = await submit(Object.fromEntries(new FormData(form)))
          if (ok !== false && reset) form.reset()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy(false)
        }
      }}
    >
      {children}
      <Notice value={error} />
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
    </form>
  )
}
export const shortDate = (v) =>
  v
    ? new Date(v).toLocaleDateString(undefined, { timeZone: 'UTC' })
    : 'Unscheduled'
export const isLate = (t) =>
  t.due &&
  new Date(t.due) < new Date(new Date().toISOString().slice(0, 10)) &&
  !['Complete', 'Rejected'].includes(t.status)
export function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
export async function file64(file) {
  if (file.size > 5 * 1024 * 1024)
    throw Error('Choose a PDF smaller than 5 MB.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(Error('Unable to read the selected file.'))
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(file)
  })
}
