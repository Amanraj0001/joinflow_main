import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { readFile, readdir } from 'node:fs/promises'
import { createApp } from '../backend/src/app.js'
const db = new PrismaClient(),
  app = createApp(db),
  origin = process.env.APP_ORIGIN
const post = (agent, url, body) =>
  agent
    .post('/api' + url)
    .set('Origin', origin)
    .send(body)
const login = (agent, email, password = process.env.DEMO_PASSWORD) =>
  post(agent, '/auth/login', { email, password })
const hr = request.agent(app),
  manager = request.agent(app),
  employee = request.agent(app),
  peer = request.agent(app)
const email = 'designer@joinflow.example',
  personalEmail = 'designer-' + Date.now() + '@example.test'
let p, managerId, hrId, policyId
async function mailToken(subject) {
  const files = await readdir('.local/mail')
  for (const f of files.reverse()) {
    const msg = JSON.parse(await readFile('.local/mail/' + f))
    if (msg.to === personalEmail && msg.subject === subject)
      return msg.text.match(/#reset=([a-f0-9]+)/)[1]
  }
  throw Error('No matching local email')
}
beforeAll(async () => {
  await login(hr, 'ellis@joinflow.example').expect(200)
  await login(manager, 'sam@joinflow.example').expect(200)
  await login(peer, 'maya@joinflow.example').expect(200)
  managerId = (await manager.get('/api/me')).body.id
  hrId = (await hr.get('/api/me')).body.id
})
afterAll(() => db.$disconnect())
describe.sequential('Portal workflows', () => {
  it('gates staff sessions on manager verification and rejects employee self-signup', async () => {
    const credentials = {
      email: 'newstaff@joinflow.example',
      password: 'ExampleStaff123!',
    }
    const guest = request.agent(app)
    await post(guest, '/auth/register', {
      ...credentials,
      name: 'New staff',
      role: 'Employee',
    }).expect(400)
    await post(guest, '/auth/register', {
      ...credentials,
      name: 'New staff',
      role: 'HR',
    }).expect(201)
    await login(guest, credentials.email, credentials.password).expect(403)
    const registered = (await manager.get('/api/team')).body.registrations.find(
      (r) => r.email === credentials.email,
    )
    await post(hr, '/registrations/' + registered.id, {
      decision: 'Approve',
    }).expect(403)
    await post(manager, '/registrations/' + registered.id, {
      decision: 'Approve',
    }).expect(200)
    await login(guest, credentials.email, credentials.password).expect(200)
  })
  it('indexes a new role policy and keeps policy-informed tasks private until HR approves', async () => {
    await post(manager, '/roles', {
      name: 'Product Design',
      steps: ['Set up the design library'],
    }).expect(201)
    const created = await post(manager, '/policies', {
      title: 'Prototype review',
      text: 'Designers submit prototype samples to the violet review board.',
      job: 'Product Design',
    }).expect(200)
    expect(created.body.processing).toBe('Ready')
    policyId = created.body.id
    const r = await post(hr, '/employees', {
      name: 'Designer',
      email,
      personalEmail,
      department: 'Design',
      job: 'Product Design',
      location: 'London',
      managerId,
      startDate: '2027-03-01',
    }).expect(201)
    expect(r.body.delivered).toBe(true)
    p = r.body
    const token = await mailToken('Your JoinFlow account')
    await post(employee, '/auth/reset', {
      token,
      password: 'DesignerAccess123!',
    }).expect(200)
    await post(employee, '/auth/reset', {
      token,
      password: 'DesignerAccess123!',
    }).expect(400)
    await login(employee, email, 'DesignerAccess123!').expect(200)
    expect((await employee.get('/api/me/checklist')).body.tasks).toHaveLength(0)
    const draft = (await hr.get('/api/team')).body.people.find(
      (e) => e.id === p.id,
    )
    expect(
      draft.tasks.some((t) => t.title === 'Set up the design library'),
    ).toBe(true)
    expect(
      draft.tasks.some((t) => t.policyRef?.includes('Prototype review')),
    ).toBe(true)
    await post(hr, '/plans/' + p.id + '/approve', {
      version: draft.version,
    }).expect(200)
    expect(
      (await employee.get('/api/me/checklist')).body.tasks.length,
    ).toBeGreaterThan(0)
    const query = { question: 'Who reviews prototype samples?' }
    expect(
      (await post(employee, '/chat', query)).body.evidence.map((e) => e.id),
    ).toContain('policy:' + policyId)
    expect(
      (await post(peer, '/chat', query)).body.evidence.map((e) => e.id),
    ).not.toContain('policy:' + policyId)
    const modified = {
      title: 'Prototype review',
      job: 'Product Design',
      mode: 'append',
      text: 'Use violet revision labels.',
      version: 1,
    }
    await post(hr, '/policies/' + policyId + '/edit', modified).expect(403)
    await post(manager, '/policies/' + policyId + '/edit', modified).expect(200)
    await post(manager, '/policies/' + policyId + '/edit', modified).expect(409)
    await post(hr, '/policies/' + policyId + '/suggest', {
      body: 'Explain revision labels.',
    }).expect(201)
    const suggestion = (await manager.get('/api/team')).body.suggestions.find(
      (s) => s.policyId === policyId,
    )
    await post(manager, '/suggestions/' + suggestion.id + '/review', {
      status: 'Approved',
      version: 2,
    }).expect(200)
    const revised = (await manager.get('/api/policies')).body.find(
      (r) => r.id === policyId,
    )
    expect(revised.body).toContain(suggestion.body)
    expect(revised.revisions).toHaveLength(2)
    await post(manager, '/policies/' + policyId + '/remove', {
      version: 3,
    }).expect(200)
    expect(
      (await post(employee, '/chat', query)).body.evidence.map((e) => e.id),
    ).not.toContain('policy:' + policyId)
  })
  it('limits private documents, supports replacement after rejection and records notifications', async () => {
    const body = {
      kind: 'Signed offer',
      filename: 'offer.pdf',
      file: Buffer.from('%PDF-1.4\nsynthetic fixture').toString('base64'),
    }
    await post(employee, '/documents', body).expect(200)
    const doc = (await employee.get('/api/me/checklist')).body.documents[0]
    await peer.get('/api/documents/' + doc.id + '/download').expect(404)
    await manager.get('/api/documents/' + doc.id + '/download').expect(403)
    await hr.get('/api/documents/' + doc.id + '/download').expect(200)
    await post(hr, '/documents/' + doc.id + '/review', {
      status: 'Rejected',
      reason: 'Missing signature',
      updatedAt: doc.updatedAt,
    }).expect(200)
    await post(employee, '/documents', body).expect(200)
    await post(hr, '/documents/' + doc.id + '/review', {
      status: 'Approved',
      updatedAt: (await employee.get('/api/me/checklist')).body.documents[0]
        .updatedAt,
    }).expect(200)
    await post(employee, '/documents', body).expect(409)
    const notice = (
      await employee.get('/api/me/checklist')
    ).body.notifications.find((n) => n.body.includes('Missing signature'))
    await post(peer, '/notifications/' + notice.id + '/read', {}).expect(404)
    await post(employee, '/notifications/' + notice.id + '/read', {}).expect(
      200,
    )
  })
  it('routes support by rule, delivers direct replies, and revokes old sessions on reset', async () => {
    const r = await post(employee, '/issues', {
      category: 'Company email',
      description: 'Inbox is unavailable',
    }).expect(201)
    expect(r.body.department).toBe('IT')
    await post(hr, '/issues/' + r.body.id + '/note', {
      body: 'Internal investigation',
    }).expect(200)
    await post(peer, '/issues/' + r.body.id + '/reply', {
      body: 'Unauthorised',
    }).expect(404)
    expect(
      (await employee.get('/api/me/checklist')).body.issues[0],
    ).not.toHaveProperty('internalNotes')
    await post(employee, '/notifications/read-all', {}).expect(200)
    expect(
      (await employee.get('/api/me/checklist')).body.notifications.every(
        (n) => n.read,
      ),
    ).toBe(true)
    await post(hr, '/issues/' + r.body.id + '/update', {
      department: 'IT',
      status: 'Resolved',
      body: 'Mailbox provisioned.',
    }).expect(200)
    expect(
      (await employee.get('/api/me/checklist')).body.issues[0].updates[0].body,
    ).toBe('Mailbox provisioned.')
    await post(employee, '/messages/' + hrId, {
      body: 'Can we meet today?',
    }).expect(201)
    await post(hr, '/messages/' + p.id, { body: 'Yes, at reception.' }).expect(
      201,
    )
    expect((await employee.get('/api/messages/' + hrId)).body).toHaveLength(2)
    expect((await peer.get('/api/messages/' + hrId)).body).toEqual([])
    await post(employee, '/auth/forgot', { email }).expect(200)
    await post(employee, '/auth/reset', {
      token: await mailToken('Reset your JoinFlow password'),
      password: 'ChangedPassword123!',
    }).expect(200)
    await employee.get('/api/me').expect(401)
    await login(employee, email, 'ChangedPassword123!').expect(200)
  })
  it('keeps bulk additions in draft and allows only the reviewed assignee to complete them', async () => {
    const title = 'Review the new starter schedule'
    await post(hr, '/plans/steps', {
      employeeId: 'all',
      title,
      description: 'Check your first-day appointments.',
      department: 'People',
      due: '2027-03-01',
    }).expect(200)
    const directory = (await hr.get('/api/team')).body.people
    expect(
      directory.every((e) =>
        e.tasks.some((t) => t.title === title && t.review === 'Draft'),
      ),
    ).toBe(true)
    const mine = directory.find((e) => e.id === p.id),
      draft = mine.tasks.find((t) => t.title === title)
    expect(
      (await employee.get('/api/me/checklist')).body.tasks.some(
        (t) => t.id === draft.id,
      ),
    ).toBe(false)
    await post(hr, '/plans/' + p.id + '/steps/' + draft.id, {
      detail: 'Confirm the induction room.',
      due: '2027-02-24',
      ownerId: hrId,
      review: 'Accepted',
    }).expect(200)
    await post(hr, '/plans/' + p.id + '/approve', {
      version: mine.version,
    }).expect(409)
    const reviewed = (await hr.get('/api/team')).body.people.find(
      (e) => e.id === p.id,
    )
    await post(hr, '/plans/' + p.id + '/approve', {
      version: reviewed.version,
    }).expect(200)
    await post(employee, '/tasks/' + draft.id + '/complete', {}).expect(404)
    await post(hr, '/tasks/' + draft.id + '/complete', {}).expect(200)
    const finished = (await employee.get('/api/me/checklist')).body.tasks.find(
      (t) => t.id === draft.id,
    )
    expect(finished.status).toBe('Complete')
    expect(finished.owner.id).toBe(hrId)
  })
})
