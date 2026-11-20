import React, { useState } from 'react'
import { Field, Form, Panel, shortDate } from '../shared/Forms'
export function Plans({ data, act, initialEmployee }) {
  const [id, select] = useState(initialEmployee || ''),
    p = data.people.find((p) => p.id === id) || data.people[0]
  const options = data.people.map((p) => [p.id, p.user.name])
  return (
    <>
      <Panel title="Add onboarding steps">
        <Form
          reset
          label="Add draft step"
          submit={(v) => act('/plans/steps', v)}
        >
          <Field
            label="Assign to"
            name="employeeId"
            value={p?.id}
            options={[...options, ['all', 'All current employees']]}
          />
          <Field label="Task title" name="title" />
          <Field label="Instructions" name="description" type="textarea" />
          <Field label="Responsible department" name="department" />
          <Field label="Due date" name="due" type="date" />
        </Form>
      </Panel>
      {p && (
        <Panel title="Review onboarding plan">
          <label>
            Employee
            <select value={p.id} onChange={(e) => select(e.target.value)}>
              {options.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p>
            {p.plan} · {p.job} · {p.department}
          </p>
          {p.tasks.map((t) => (
            <details key={t.id + ':' + p.version}>
              <summary>
                {t.title} · {t.review}
              </summary>
              <p>{t.description}</p>
              <small>
                {t.source} · {t.department} · {shortDate(t.due)}
                {t.confidence != null &&
                  ' · Model confidence estimate ' +
                    Math.round(t.confidence * 100) +
                    '%'}
                {t.policyRef && ' · Policy: ' + t.policyRef}
              </small>
              {t.review !== 'Approved' && (
                <Form
                  label="Save task review"
                  submit={(v) => act('/plans/' + p.id + '/steps/' + t.id, v)}
                >
                  <Field
                    label="Instructions"
                    name="detail"
                    type="textarea"
                    value={t.description}
                  />
                  <Field
                    label="Deadline"
                    name="due"
                    type="date"
                    value={(t.due || p.startDate).slice(0, 10)}
                  />
                  <Field
                    label="Assignee"
                    name="ownerId"
                    options={[p.user, p.manager, ...data.staff].map((u) => [
                      u.id,
                      u.name,
                    ])}
                    value={t.owner.id}
                  />
                  {!t.approval && t.templateId !== 'identity' && (
                    <Field
                      name="evidenceKind"
                      label="Required evidence"
                      value={t.evidenceKind || ''}
                      required={false}
                      options={[
                        ['', 'No document required'],
                        'Identity document',
                        'Signed offer',
                      ]}
                    />
                  )}
                  <Field
                    label="Task review"
                    name="review"
                    options={
                      t.required
                        ? ['Draft', 'Accepted']
                        : ['Draft', 'Accepted', 'Rejected']
                    }
                    value={t.review}
                  />
                </Form>
              )}
            </details>
          ))}
          {(p.plan === 'Draft' ||
            p.tasks.some((t) => ['Accepted', 'Draft'].includes(t.review))) && (
            <button
              className="primary"
              onClick={() =>
                act('/plans/' + p.id + '/approve', { version: p.version })
              }
            >
              Approve onboarding plan
            </button>
          )}
        </Panel>
      )}
    </>
  )
}
