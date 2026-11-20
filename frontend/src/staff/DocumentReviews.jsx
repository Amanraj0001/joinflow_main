import React, { useState } from 'react'
import { Panel, Field, Form } from '../shared/Forms'
export function DocumentReviews({ data, people, act }) {
  return (
    <Panel title="Employee document reviews">
      {data.documents.length === 0 && <p>No documents submitted.</p>}
      {data.documents.map((d) => (
        <article className="handoff" key={d.id}>
          <strong>
            {people.find((p) => p.id === d.employeeId)?.user.name} · {d.kind}
          </strong>
          <p>
            {d.status} ·{' '}
            <a href={'/api/documents/' + d.id + '/download'}>
              Download {d.filename}
            </a>
          </p>
          <details>
            <summary>Preview original PDF</summary>
            <iframe
              title={d.filename}
              width="100%"
              height="480"
              src={'/api/documents/' + d.id + '/preview'}
            />
          </details>
          {d.analysis && (
            <details open>
              <summary>Assisted review</summary>
              <p>Detected type · {d.analysis.type || 'Undetermined'}</p>
              <p className="longtext">{d.analysis.excerpt}</p>
              {d.analysis.observations.map((o) => (
                <p key={o}>{o}</p>
              ))}
              {d.analysis.checks?.length > 0 && (
                <>
                  <h3>AI-suggested manual checks</h3>
                  <ul>
                    {d.analysis.checks.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </details>
          )}
          {[
            'Processing',
            'Uploaded',
            'Pending Review',
            'Needs HR Review',
          ].includes(d.status) && (
            <button
              onClick={() => act('/documents/' + d.id + '/reprocess', {})}
            >
              Retry extraction
            </button>
          )}
          {['Needs HR Review', 'Pending Review'].includes(d.status) && (
            <Form
              label="Submit review"
              submit={(v) =>
                act('/documents/' + d.id + '/review', {
                  ...v,
                  updatedAt: d.updatedAt,
                })
              }
            >
              <Field
                label="Decision"
                name="status"
                options={['Approved', 'Rejected', 'Resubmission Required']}
              />
              <Field
                label="Reason (required for rejection)"
                name="reason"
                required={false}
              />
            </Form>
          )}
        </article>
      ))}
    </Panel>
  )
}
