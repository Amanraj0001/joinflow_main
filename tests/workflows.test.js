import { beforeAll, afterAll, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { readFileSync } from 'node:fs'
import { createApp } from '../backend/src/app.js'
import { chat } from '../backend/src/knowledge/chat.js'
const db = new PrismaClient(),
  app = createApp(db)
const origin = process.env.APP_ORIGIN
async function login(slug) {
  const agent = request.agent(app)
  await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({
      email: slug + '@joinflow.example',
      password: process.env.DEMO_PASSWORD,
    })
    .expect(200)
  return agent
}
const post = (agent, path, data) =>
  agent
    .post('/api' + path)
    .set('Origin', origin)
    .send(data)
let alex, maya, hr, manager, profile, other
beforeAll(async () => {
  ;[alex, maya, hr, manager] = await Promise.all(
    ['alex', 'maya', 'ellis', 'sam'].map(login),
  )
  profile = (await alex.get('/api/me/checklist')).body
  other = (await maya.get('/api/me/checklist')).body
})
afterAll(() => db.$disconnect())
it('scopes checklist generation, reads, writes and login origin', async () => {
  expect(profile.tasks.map((t) => t.templateId)).toContain('repo')
  expect(other.tasks.map((t) => t.templateId)).toContain('ops')
  expect(other.tasks.map((t) => t.templateId)).not.toContain('london')
  await request(app).get('/api/me/checklist').expect(401)
  await alex.get('/api/team').expect(403)
  await alex
    .post('/api/handoffs')
    .set('Origin', 'https://wrong.example')
    .send({ question: 'test' })
    .expect(403)
  await post(alex, '/tasks/' + other.tasks[1].id + '/complete', {}).expect(404)
  await post(alex, '/chat', {
    question: 'My tasks',
    employeeId: other.id,
  }).expect(400)
  await post(
    alex,
    '/tasks/' +
      profile.tasks.find((t) => t.templateId === 'setup').id +
      '/complete',
    {},
  ).expect(409)
})
it('evaluates the fixed 20 questions against authorized live PostgreSQL evidence', async () => {
  const times = [],
    counts = { policy: 0, status: 0, handoff: 0, boundary: 0 }
  for (const [kind, question, expected] of JSON.parse(
    readFileSync('tests/questions.json'),
  )) {
    const start = performance.now()
    const { body } = await post(alex, '/chat', { question }).expect(200)
    times.push(performance.now() - start)
    if (kind === 'policy')
      expect(
        body.evidence.map((e) => e.id),
        question,
      ).toContain('policy:' + expected)
    if (kind === 'status')
      expect(
        body.evidence.map((e) => e.id),
        question,
      ).toContain(
        'task:' + profile.tasks.find((t) => t.templateId === expected).id,
      )
    if (kind === 'handoff') expect(body.escalate, question).toBe(true)
    if (kind === 'boundary') expect(body.mode, question).toBe('denied')
    counts[kind]++
  }
  times.sort((a, b) => a - b)
  const medianMs = ((times[9] + times[10]) / 2).toFixed(1)
  process.stdout.write(
    'Chat evaluation ' + JSON.stringify({ counts, medianMs }) + '\n',
  )
})
it('uses available evidence after timeout and rejects unrecognized citations', async () => {
  const timed = await chat(db, profile.id, 'What is blocked?', {
    infer: () => new Promise(() => {}),
    timeout: 10,
  })
  expect(timed.mode).toBe('timeout')
  expect(timed.text).toContain('Sam Rivera')
  const bad = await chat(db, profile.id, 'What is blocked?', {
    infer: async () => ({
      text: 'Incorrect',
      evidenceIds: ['unexpected'],
      escalate: false,
    }),
  })
  expect(bad.mode).toBe('invalid-evidence')
})
it('validates managerial authority and records one decision on concurrent retries', async () => {
  const a = profile.tasks.find((t) => t.templateId === 'laptop').approval
  const path = '/approvals/' + a.id + '/decision'
  await post(alex, path, { decision: 'approved' }).expect(403)
  await db.user.create({
    data: {
      name: 'Other Manager',
      email: 'other@joinflow.example',
      role: 'Manager',
      hash: (await db.user.findFirstOrThrow({ where: { role: 'Manager' } }))
        .hash,
    },
  })
  const outsider = await login('other')
  await post(outsider, path, { decision: 'approved' }).expect(404)
  await Promise.all(
    [1, 2].map(() => post(manager, path, { decision: 'approved' }).expect(200)),
  )
  expect(
    await db.audit.count({
      where: { employeeId: profile.id, message: { contains: 'was approved' } },
    }),
  ).toBe(1)
  const fresh = (await alex.get('/api/me/checklist')).body
  expect(fresh.tasks.find((t) => t.templateId === 'setup').status).toBe(
    'Available',
  )
  const { body } = await post(alex, '/chat', { question: 'What is blocked?' })
  expect(
    body.evidence.find((e) => e.title === 'Set up your workstation').body,
  ).toContain('Available')
})
it('preserves completed location work and rejects an outdated preview', async () => {
  const path = '/employees/' + profile.id
  const preview = async () =>
    (
      await post(hr, path + '/change-preview', { location: 'Austin' }).expect(
        200,
      )
    ).body
  const initial = await preview()
  expect(initial.removed.map((t) => t.id)).toContain('london')
  expect((await alex.get('/api/me/checklist')).body.location).toBe('London')
  await post(
    alex,
    '/tasks/' +
      profile.tasks.find((t) => t.templateId === 'london').id +
      '/complete',
    {},
  ).expect(200)
  await post(hr, path + '/apply-change', {
    location: 'Austin',
    version: initial.version,
  }).expect(409)
  const updated = await preview()
  expect(updated.retained.map((t) => t.id)).toContain('london')
  await post(hr, path + '/apply-change', {
    location: 'Austin',
    version: updated.version,
  }).expect(200)
  const current = (await alex.get('/api/me/checklist')).body
  expect(current.tasks.find((t) => t.templateId === 'london').status).toBe(
    'Complete',
  )
  expect(current.tasks.some((t) => t.templateId === 'austin')).toBe(true)
})
it('creates a hire and delivers only explicitly submitted handoffs to HR', async () => {
  const data = {
    name: 'Test Hire',
    department: 'Operations',
    personalEmail: 'personal@example.test',
    email: 'test@joinflow.example',
    password: process.env.DEMO_PASSWORD,
    job: 'Operations',
    location: 'Austin',
    managerId: profile.managerId,
    startDate: '2027-02-01',
  }
  await post(hr, '/employees', data).expect(201)
  await post(hr, '/employees', data).expect(409)
  const hire = await login('test')
  expect((await hire.get('/api/me/checklist')).body.tasks).toHaveLength(0)
  const draft = (await hr.get('/api/team')).body.people.find(
    (p) => p.user.email === data.email,
  )
  expect(draft.tasks.some((t) => t.source === 'Role')).toBe(true)
  await post(hire, '/tasks/' + draft.tasks[0].id + '/complete', {}).expect(404)
  await post(hr, '/plans/' + draft.id + '/approve', {
    version: draft.version,
  }).expect(200)
  expect(
    (await hire.get('/api/me/checklist')).body.tasks.length,
  ).toBeGreaterThan(10)
  expect((await hr.get('/api/team')).body.handoffs).toHaveLength(0)
  await post(hire, '/handoffs', { question: 'Is relocation covered?' }).expect(
    201,
  )
  const [item] = (await hr.get('/api/team')).body.handoffs
  const reply = '/handoffs/' + item.id + '/reply'
  const answer = { answer: 'I will send you the relocation guide.' }
  await post(maya, reply, answer).expect(403)
  await post(manager, reply, answer).expect(403)
  await post(hr, reply, { answer: ' ' }).expect(400)
  await post(hr, reply, answer).expect(200)
  await post(hr, reply, { answer: 'Second response' }).expect(409)
  expect((await hire.get('/api/me/checklist')).body.handoffs[0]).toMatchObject({
    ...answer,
    id: item.id,
    answeredBy: 'Ellis Morgan',
    answeredAt: expect.any(String),
  })
  expect((await maya.get('/api/me/checklist')).body.handoffs).toEqual([])
  expect((await manager.get('/api/team')).body.handoffs).toEqual([])
})

it('reaches day-one readiness while optional work remains open', async () => {
  await post(
    manager,
    '/approvals/' +
      other.tasks.find((t) => t.templateId === 'laptop').approval.id +
      '/decision',
    { decision: 'approved' },
  ).expect(200)
  const identity = other.tasks.find((t) => t.templateId === 'identity')
  await post(maya, '/tasks/' + identity.id + '/complete', {}).expect(409)
  await post(maya, '/documents', {
    kind: 'Identity document',
    filename: 'identity.pdf',
    file: Buffer.from('%PDF-1.4 sample').toString('base64'),
  }).expect(200)
  const document = (await maya.get('/api/me/checklist')).body.documents.find(
    (d) => d.kind === 'Identity document',
  )
  await post(hr, '/documents/' + document.id + '/review', {
    status: 'Approved',
    updatedAt: document.updatedAt,
  }).expect(200)
  const available = (await maya.get('/api/me/checklist')).body.tasks
  for (const task of available.filter(
    (t) => t.required && t.status === 'Available',
  )) {
    await post(maya, '/tasks/' + task.id + '/complete', {}).expect(200)
  }
  const ready = (await maya.get('/api/me/checklist')).body
  expect(ready.readiness.ready).toBe(true)
  expect(ready.readiness.remaining).toEqual([])
  expect(ready.tasks.some((t) => !t.required && t.status === 'Available')).toBe(
    true,
  )
  expect(
    (await post(maya, '/chat', { question: 'Am I ready for day one?' })).body
      .text,
  ).toContain('ready for day one')
})
