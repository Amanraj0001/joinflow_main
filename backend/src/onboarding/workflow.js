export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function eligible(t, profile) {
  return (
    !t.custom &&
    (!t.job || t.job === profile.job) &&
    (!t.location || t.location === profile.location)
  )
}
export const safeUser = {
  id: true,
  name: true,
  role: true,
  email: true,
  department: true,
}
export async function checklist(db, id, includeDraft = false) {
  const profile = await db.employee.findUniqueOrThrow({
    where: { id },
    include: {
      user: { select: safeUser },
      manager: { select: safeUser },
      tasks: {
        where: {
          active: true,
          ...(includeDraft
            ? {}
            : { review: 'Approved', employee: { plan: 'Approved' } }),
        },
        include: {
          template: { include: { prerequisites: true } },
          owner: { select: safeUser },
          approval: true,
        },
        orderBy: { template: { position: 'asc' } },
      },
      events: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
    },
  })
  const tasks = profile.tasks.map((t) => {
    const needs = t.template.prerequisites
      .map((d) => profile.tasks.find((p) => p.templateId === d.parentId))
      .filter((p) => p && !p.completedAt)
      .map((p) => ({ id: p.id, title: p.template.title, owner: p.owner.name }))
    const status =
      t.review !== 'Approved'
        ? t.review
        : t.completedAt
          ? 'Complete'
          : needs.length || t.approval?.decision === 'declined'
            ? 'Blocked'
            : t.startedAt
              ? 'In progress'
              : 'Available'
    return {
      id: t.id,
      templateId: t.templateId,
      completedAt: t.completedAt,
      evidenceKind:
        t.templateId === 'identity' ? 'Identity document' : t.evidenceKind,
      completionMethod:
        t.templateId === 'identity' || t.evidenceKind
          ? 'Evidence'
          : t.approval || t.owner.role !== 'Employee'
            ? 'Approval'
            : 'Self-attested',
      title: t.template.title,
      category: t.template.category,
      description: t.detail || t.template.description,
      due: t.due,
      department: t.department,
      source: t.source,
      policyRef: t.policyRef,
      confidence: t.confidence,
      review: t.review,
      required: t.template.required,
      owner: t.owner,
      approval: t.approval,
      needs,
      status,
    }
  })
  const required = tasks.filter((t) => t.required)
  const remaining = required.filter((t) => t.status !== 'Complete')
  return {
    ...profile,
    tasks,
    readiness: {
      total: required.length,
      complete: required.length - remaining.length,
      ready: profile.plan === 'Approved' && remaining.length === 0,
      remaining: remaining.map((t) => t.id),
    },
    next: tasks.find(
      (t) =>
        t.owner.id === profile.userId &&
        ['Available', 'In progress'].includes(t.status),
    )?.id,
  }
}
export async function preview(db, employee, location) {
  const templates = await db.template.findMany({ orderBy: { position: 'asc' } })
  const tasks = await db.task.findMany({
    where: { employeeId: employee.id, active: true },
  })
  const result = {
    added: [],
    removed: [],
    retained: [],
    version: employee.version,
    location,
  }
  for (const t of templates) {
    const active = tasks.find((a) => a.templateId === t.id)
    if (active)
      result[
        active.completedAt || t.custom || eligible(t, { ...employee, location })
          ? 'retained'
          : 'removed'
      ].push(t)
    else if (eligible(t, { ...employee, location })) result.added.push(t)
  }
  return result
}
export async function assign(
  db,
  employee,
  templates,
  review = employee.plan === 'Draft' ? 'Draft' : 'Approved',
) {
  for (const t of templates) {
    const task = await db.task.upsert({
      where: {
        employeeId_templateId: { employeeId: employee.id, templateId: t.id },
      },
      update: { active: true },
      create: {
        employeeId: employee.id,
        templateId: t.id,
        review,
        due: employee.startDate,
        department:
          t.category === 'Equipment'
            ? 'IT'
            : t.category === 'Payroll'
              ? 'Finance'
              : 'People',
        ownerId:
          t.ownerRole === 'Manager' ? employee.managerId : employee.userId,
      },
    })
    if (t.ownerRole === 'Manager')
      await db.approval.upsert({
        where: { taskId: task.id },
        update: {},
        create: { taskId: task.id },
      })
  }
}
export async function lockProfile(db, id) {
  const rows =
    await db.$queryRaw`SELECT "id" FROM "Employee" WHERE "id"=${id} FOR UPDATE`
  if (!rows.length) throw new HttpError(404, 'Employee not found.')
  return db.employee.findUniqueOrThrow({ where: { id } })
}
export async function record(db, employeeId, actorId, message, taskId) {
  await db.audit.create({ data: { employeeId, actorId, message, taskId } })
  return db.employee.update({
    where: { id: employeeId },
    data: { version: { increment: 1 } },
  })
}
