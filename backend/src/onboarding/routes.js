import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { locations } from './catalog.js'
import {
  assign,
  checklist,
  eligible,
  HttpError,
  lockProfile,
  preview,
  record,
} from './workflow.js'
import { suggestions, addStep } from './plans.js'
import { sendAccess } from '../auth/accounts.js'

export function onboardingRoutes(app, db, role) {
  app.post('/api/employees', role('HR'), async (req, res) => {
    const {
      name,
      email,
      password,
      job,
      location,
      managerId,
      startDate,
      personalEmail,
      department,
    } = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.email().max(254),
        password: z.string().min(10).max(72).optional(),
        personalEmail: z.email(),
        department: z.string().trim().min(1).max(100),
        job: z.string().min(1).max(180),
        location: z.enum(locations),
        managerId: z.string(),
        startDate: z.iso.date(),
      })
      .strict()
      .parse(req.body)
    const jobRole = await db.jobRole.findUnique({ where: { name: job } })
    if (!jobRole) throw new HttpError(400, 'Select an existing job role.')
    const steps = await suggestions(db, { job, department, location }, jobRole)
    const hash = await bcrypt.hash(password || randomUUID(), 12)
    const employee = await db.$transaction(
      async (tx) => {
        if (
          !(await tx.user.findFirst({
            where: { id: managerId, role: 'Manager', verified: true },
          }))
        )
          throw new HttpError(400, 'Choose a manager.')
        const user = await tx.user.create({
          data: { name, email: email.toLowerCase(), hash, role: 'Employee' },
        })
        const profile = await tx.employee.create({
          data: {
            userId: user.id,
            personalEmail,
            department,
            plan: 'Draft',
            job,
            location,
            managerId,
            startDate: new Date(startDate),
          },
        })
        await assign(
          tx,
          profile,
          (await tx.template.findMany()).filter((t) => eligible(t, profile)),
        )
        for (const step of steps) await addStep(tx, profile, step)
        return record(
          tx,
          profile.id,
          req.user.id,
          'Created the draft onboarding checklist.',
        )
      },
      { timeout: 30000 },
    )
    const delivered = await sendAccess(
      db,
      { id: employee.userId, email },
      personalEmail,
      true,
    )
    res.status(201).json({ ...employee, delivered })
  })
  app.post(
    '/api/tasks/:id/start',
    role('Employee', 'Manager', 'HR'),
    async (req, res) => {
      await db.$transaction(async (tx) => {
        const row = await tx.task.findFirstOrThrow({
          where: { id: req.params.id, ownerId: req.user.id, approval: null },
        })
        await lockProfile(tx, row.employeeId)
        const t = (await checklist(tx, row.employeeId)).tasks.find(
          (t) => t.id === row.id,
        )
        if (!t || t.status !== 'Available')
          throw new HttpError(409, 'Task is unavailable.')
        await tx.task.update({
          where: { id: t.id },
          data: { startedAt: new Date() },
        })
        await record(
          tx,
          row.employeeId,
          req.user.id,
          'Started ' + t.title + '.',
          t.id,
        )
      })
      res.json({ ok: true })
    },
  )
  app.post(
    '/api/tasks/:id/complete',
    role('Employee', 'Manager', 'HR'),
    async (req, res) => {
      await db.$transaction(async (tx) => {
        const owned = await tx.task.findFirst({
          where: {
            id: req.params.id,
            ownerId: req.user.id,
            approval: null,
            active: true,
            review: 'Approved',
            employee: { plan: 'Approved' },
          },
        })
        if (!owned) throw new HttpError(404, 'Task not found.')
        const employee = await lockProfile(tx, owned.employeeId)
        const task = (await checklist(tx, employee.id)).tasks.find(
          (t) => t.id === req.params.id && t.owner.id === req.user.id,
        )
        if (!task) throw new HttpError(404, 'Task not found.')
        if (task.status === 'Complete') return
        if (!['Available', 'In progress'].includes(task.status))
          throw new HttpError(409, 'Complete the prerequisites first.')
        if (
          task.completionMethod === 'Evidence' &&
          !(await tx.submission.findFirst({
            where: {
              employeeId: employee.id,
              kind: task.evidenceKind,
              status: 'Approved',
            },
          }))
        )
          throw new HttpError(
            409,
            'HR must approve the required document first.',
          )
        await tx.task.update({
          where: { id: task.id },
          data: { completedAt: new Date() },
        })
        await record(
          tx,
          employee.id,
          req.user.id,
          'Completed ' + task.title + '.',
          task.id,
        )
      })
      res.json({ ok: true })
    },
  )
  app.post('/api/approvals/:id/decision', role('Manager'), async (req, res) => {
    const { decision } = z
      .object({ decision: z.enum(['approved', 'declined']) })
      .strict()
      .parse(req.body)
    await db.$transaction(async (tx) => {
      const item = await tx.approval.findFirst({
        where: {
          id: req.params.id,
          task: {
            active: true,
            ownerId: req.user.id,
            employee: { managerId: req.user.id },
          },
        },
        include: { task: true },
      })
      if (!item) throw new HttpError(404, 'Approval not found.')
      await lockProfile(tx, item.task.employeeId)
      const task = (await checklist(tx, item.task.employeeId)).tasks.find(
        (t) => t.id === item.task.id,
      )
      if (!task)
        throw new HttpError(409, 'Checklist changed. Refresh your view.')
      if (task.approval.decision === decision) return
      if (task.approval.decision || task.status !== 'Available')
        throw new HttpError(409, 'This decision is closed.')
      await tx.approval.update({
        where: { id: item.id },
        data: { decision, decidedAt: new Date() },
      })
      if (decision === 'approved')
        await tx.task.update({
          where: { id: task.id },
          data: { completedAt: new Date() },
        })
      await record(
        tx,
        item.task.employeeId,
        req.user.id,
        task.title + ' was ' + decision + '.',
        task.id,
      )
    })
    res.json({ ok: true })
  })
  const change = z.object({ location: z.enum(locations) }).strict()
  app.post(
    '/api/employees/:id/change-preview',
    role('HR'),
    async (req, res) => {
      const { location } = change.parse(req.body)
      res.json(
        await db.$transaction(async (tx) =>
          preview(tx, await lockProfile(tx, req.params.id), location),
        ),
      )
    },
  )
  app.post('/api/employees/:id/apply-change', role('HR'), async (req, res) => {
    const { location, version } = change
      .extend({ version: z.number().int().positive() })
      .parse(req.body)
    await db.$transaction(async (tx) => {
      const employee = await lockProfile(tx, req.params.id)
      if (version !== employee.version)
        throw new HttpError(
          409,
          'The checklist changed. Preview the change again.',
        )
      if (location === employee.location) return
      const delta = await preview(tx, employee, location)
      await tx.task.updateMany({
        where: {
          employeeId: employee.id,
          templateId: { in: delta.removed.map((t) => t.id) },
        },
        data: { active: false },
      })
      await assign(tx, employee, delta.added)
      await tx.employee.update({
        where: { id: employee.id },
        data: { location },
      })
      await record(
        tx,
        employee.id,
        req.user.id,
        'Changed location from ' + employee.location + ' to ' + location + '.',
      )
    })
    res.json({ ok: true })
  })
}
