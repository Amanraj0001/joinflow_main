import React, { useEffect, useState } from 'react'
import { api } from '../shared/api'
import { Form, Field, Panel, file64 } from '../shared/Forms'
import { Notice } from '../shared/ui'
export function Policies({ user, data, act }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(''),
    [version, reload] = useState(0)
  useEffect(() => {
    let live = true
    api('/policies')
      .then((r) => {
        if (live) setRows(r)
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [version])
  async function save(path, body) {
    const success = await act(path, body)
    if (success) reload((n) => n + 1)
    return success
  }
  function editor(p) {
    return (
      <Form
        reset={!p}
        label={p ? 'Process update' : 'Add policy'}
        submit={async ({ file, ...v }) =>
          save(p ? '/policies/' + p.id + '/edit' : '/policies', {
            ...v,
            ...(file?.size ? { pdf: await file64(file) } : {}),
            version: p?.version,
          })
        }
      >
        <Field label="Policy title" name="title" value={p?.title} />
        <Field
          label="Description"
          name="description"
          value={p?.description}
          required={false}
        />
        <Field
          label="Category"
          name="category"
          value={p?.category}
          required={false}
        />
        <Field
          label="Effective date"
          name="effectiveDate"
          type="date"
          value={p?.effectiveDate}
          required={false}
        />
        <Field
          label="Policy owner"
          name="ownerId"
          value={p?.ownerId || user.id}
          options={(data.policyOwners || [user]).map((m) => [m.id, m.name])}
        />
        {p && (
          <Field
            label="Action"
            name="mode"
            options={['append', 'replace', 'reindex']}
          />
        )}
        <Field
          label="Policy text"
          name="text"
          type="textarea"
          required={false}
        />
        <Field
          label="PDF source"
          name="file"
          type="file"
          accept="application/pdf"
          required={false}
        />
        <div className="formgrid">
          {['department', 'location', 'job'].map((k) => (
            <Field
              key={k}
              label={k + ' scope (blank for all)'}
              name={k}
              value={p?.[k]}
              required={false}
            />
          ))}
        </div>
      </Form>
    )
  }
  return (
    <>
      <Notice value={error} />
      {user.role === 'Manager' && (
        <Panel title="New policy">{editor(null)}</Panel>
      )}
      <Panel title="Company knowledge base">
        {rows.map((p) => (
          <details key={p.id + ':' + p.version}>
            <summary>
              {p.title} · v{p.version} · {p.processing} · {p.owner}
            </summary>
            <small>
              {p.approved ? 'Published' : 'Unpublished'} · {p.category} ·{' '}
              {p.updatedAt
                ? 'Updated ' + new Date(p.updatedAt).toLocaleDateString()
                : 'Original edition'}{' '}
              {p.modifiedBy && 'by ' + p.modifiedBy}
            </small>
            <p>
              {p.description}{' '}
              {p.effectiveDate && ' · Effective ' + p.effectiveDate}
            </p>
            {!!p.revisions.length && (
              <details>
                <summary>Version history</summary>
                {p.revisions.map((r) => (
                  <article key={r.version}>
                    <strong>
                      v{r.version} · {r.title} ·{' '}
                      {r.modifiedBy || 'Original edition'}
                    </strong>
                    <p>{r.body}</p>
                  </article>
                ))}
              </details>
            )}
            <p className="longtext">{p.body}</p>
            <small>
              {[p.department, p.job, p.location].filter(Boolean).join(' · ') ||
                'Company-wide'}
            </small>
            {user.role === 'HR' ? (
              <Form
                reset
                label="Suggest update"
                submit={(v) => save('/policies/' + p.id + '/suggest', v)}
              >
                <Field label="Suggested change" name="body" type="textarea" />
              </Form>
            ) : (
              (!p.ownerId || p.ownerId === user.id) && (
                <>
                  {editor(p)}
                  <button
                    className="secondary"
                    onClick={() => {
                      if (
                        confirm('Remove this policy from the knowledge base?')
                      )
                        save('/policies/' + p.id + '/remove', {
                          version: p.version,
                        })
                    }}
                  >
                    Remove policy
                  </button>
                </>
              )
            )}
          </details>
        ))}
      </Panel>
      <Panel title="HR policy suggestions">
        {data.suggestions.map((s) => (
          <article className="handoff" key={s.id}>
            <strong>
              {rows.find((r) => r.id === s.policyId)?.title ||
                'Archived policy'}
            </strong>
            <p>{s.body}</p>
            <small>
              {s.author} · {s.status}
            </small>
            {user.role === 'Manager' &&
              s.status === 'Pending' &&
              ['Approved', 'Declined'].map((status) => (
                <button
                  className="secondary"
                  key={status}
                  onClick={() =>
                    (status !== 'Approved' ||
                      confirm(
                        'Publish this suggestion as an addition to the policy?',
                      )) &&
                    save('/suggestions/' + s.id + '/review', {
                      status,
                      version: rows.find((r) => r.id === s.policyId)?.version,
                    })
                  }
                >
                  {status}
                </button>
              ))}
          </article>
        ))}
      </Panel>
    </>
  )
}
