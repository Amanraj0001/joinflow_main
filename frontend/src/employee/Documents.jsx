import React, { useEffect, useRef } from 'react'
import { FileText, Download } from 'lucide-react'
import { Panel, Form, Field, file64, shortDate } from '../shared/Forms'

const sections = ['Needs resubmission', 'To upload', 'Waiting for HR review', 'Processing', 'Approved']

function sectionFor(doc) {
  if (!doc) return 'To upload'
  if (['Rejected', 'Resubmission Required'].includes(doc.status)) return 'Needs resubmission'
  if (['Uploaded', 'Processing'].includes(doc.status)) return 'Processing'
  if (doc.status === 'Approved') return 'Approved'
  return 'Waiting for HR review'
}

export function Documents({ profile, target, act }) {
  const targetCard = useRef(null)
  const rows = profile.requiredDocuments.map(kind => {
    const doc = profile.documents.find(item => item.kind === kind)
    return { kind, doc, section: sectionFor(doc) }
  })
  const next = rows.find(row => row.section === 'Needs resubmission') ||
    rows.find(row => row.section === 'To upload')
  const approved = rows.filter(row => row.section === 'Approved').length

  useEffect(() => {
    if (target) targetCard.current?.focus()
  }, [target])

  return <div className="document-workspace">
    <section className="document-overview">
      <div>
        <div className="eyebrow"><FileText size={16}/> Next upload</div>
        <h2>{next ? next.kind : 'No upload needed'}</h2>
        <p>{next ? (next.doc ? 'HR requested a corrected copy.' : 'Submit this document to HR.')
          : approved < rows.length ? 'Your submitted documents are being processed or reviewed.'
          : rows.length ? 'HR has approved all your required documents.' : 'No documents have been requested.'}</p>
        {next && <button className="secondary" onClick={() =>
          document.getElementById('upload-' + next.kind)?.focus()
        }>{next.doc ? 'Go to replacement' : 'Go to upload'}</button>}
      </div>
      <div className="document-progress">
        <strong>{approved} of {rows.length} approved</strong>
        <progress aria-label="Required documents approved" value={approved} max={rows.length || 1}/>
      </div>
    </section>
    {sections.map(section => {
      const items = rows.filter(row => row.section === section)
      if (!items.length) return null
      return <Panel key={section} title={section + ' (' + items.length + ')'}>
        {items.map(({kind, doc}) => <article key={kind} className="document-item"
          tabIndex={-1} ref={target && target === doc?.id ? targetCard : undefined}>
          <div className="document-heading">
            <h3>{kind}</h3>
            <small>{doc?.status || 'Awaiting submission'}</small>
          </div>
          {doc?.reason && <p className="document-feedback"><strong>HR feedback</strong>{doc.reason}</p>}
          {doc && <div className="document-file">
            <a href={'/api/documents/' + doc.id + '/download'}><Download size={15}/> {doc.filename}</a>
            <small>Updated {shortDate(doc.updatedAt)}</small>
          </div>}
          {(!doc || section === 'Needs resubmission') && <Form reset
            label={doc ? 'Replace document' : 'Submit document'}
            submit={async ({file}) => act('/documents', { kind, filename: file.name, file: await file64(file) })}>
            <Field id={'upload-' + kind} label="PDF, up to 5 MB" type="file" accept="application/pdf" name="file"/>
          </Form>}
        </article>)}
      </Panel>
    })}
  </div>
}
