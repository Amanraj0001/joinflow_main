import { checklist, safeUser } from '../onboarding/workflow.js'
import { employeeExtras, hrExtras } from '../employee/services.js'

export function overviewRoutes(app, db, role) {
  app.get('/api/me/checklist', role('Employee'), async (req, res) => {
    const id = req.user.profile.id
    const [profile, handoffs] = await Promise.all([
      checklist(db, id),
      db.handoff.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    res.json({ ...profile, handoffs, ...(await employeeExtras(db, profile)) })
  })
  app.get('/api/team', role('Manager', 'HR'), async (req, res) => {
    const ids = await db.employee.findMany({
      where: req.user.role === 'Manager' ? { managerId: req.user.id } : {},
      select: { id: true },
      orderBy: { user: { name: 'asc' } },
    })
    const people = await Promise.all(
      ids.map((e) => checklist(db, e.id, req.user.role === 'HR')),
    )
    const managers =
      req.user.role === 'HR'
        ? await db.user.findMany({
            where: { role: 'Manager', verified: true },
            select: safeUser,
          })
        : []
    const handoffs =
      req.user.role === 'HR'
        ? await db.handoff.findMany({
            orderBy: { createdAt: 'desc' },
          })
        : []
    const roles = await db.jobRole.findMany({ orderBy: { name: 'asc' } })
    const registrations =
      req.user.role === 'Manager'
        ? await db.user.findMany({
            where: { verified: false },
            select: safeUser,
          })
        : []
    const suggestions = await db.policySuggestion.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const staff = await db.user.findMany({
      where: { verified: true, role: 'HR' },
      select: safeUser,
    })
    res.json({
      people,
      managers,
      policyOwners:
        req.user.role === 'Manager'
          ? await db.user.findMany({
              where: { role: 'Manager', verified: true },
              select: { id: true, name: true },
            })
          : [],
      handoffs,
      roles,
      registrations,
      suggestions,
      staff,
      ...(req.user.role === 'HR'
        ? await hrExtras(db)
        : {
            issues: await db.issue.findMany({
              omit: { attachment: true, internalNotes: true },
              where: { department: req.user.department },
              orderBy: { createdAt: 'desc' },
              include: {
                employee: { select: { user: { select: { name: true } } } },
              },
            }),
          }),
    })
  })

  app.get('/api/hr/stats', role('HR'), async (req, res) => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 86400000)

    const [employees, tasks, issues] = await Promise.all([
      db.employee.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          manager: { select: { id: true, name: true } },
          tasks: {
            where: { active: true },
            include: { template: true },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
      db.task.findMany({
        where: { active: true, review: 'Approved', employee: { plan: 'Approved' } },
        include: {
          template: true,
          owner: { select: { id: true, name: true } },
          employee: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
      db.issue.findMany({
        omit: { attachment: true, internalNotes: true },
        where: { status: { notIn: ['Resolved', 'Closed'] } },
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { user: { select: { name: true } } } } },
      }),
    ])

    const pendingApprovals = employees.filter(
      (e) =>
        e.plan === 'Draft' ||
        e.tasks.some((t) => ['Draft', 'Accepted'].includes(t.review)),
    ).length

    const joiningCount = employees.filter((e) => {
      const start = new Date(e.startDate)
      return start >= now && start <= twoWeeksFromNow
    }).length

    const pendingTasks = tasks.filter(
      (t) => t.completedAt === null,
    ).length

    const overdueTasks = tasks.filter(
      (t) =>
        t.completedAt === null &&
        t.due &&
        new Date(t.due) < new Date(todayStr),
    ).length

    const criticalBlockers = tasks.filter(
      (t) =>
        t.completedAt === null &&
        t.template.required &&
        t.due &&
        new Date(t.due) < new Date(todayStr),
    ).length

    // Department-wise progress
    const depts = [...new Set(tasks.map((t) => t.department || 'General'))]
    const deptProgress = depts.map((dept) => {
      const deptTasks = tasks.filter((t) => (t.department || 'General') === dept)
      const completed = deptTasks.filter((t) => t.completedAt !== null).length
      return { dept, total: deptTasks.length, completed }
    })

    // At-risk employees
    const atRisk = employees.filter((e) => {
      const start = new Date(e.startDate)
      const daysUntilStart = (start - now) / 86400000
      const hasOverdueRequired = e.tasks.some(
        (t) =>
          t.active &&
          t.review === 'Approved' &&
          t.completedAt === null &&
          t.template.required &&
          t.due &&
          new Date(t.due) < new Date(todayStr),
      )
      const hasBlockedRequired = e.tasks.some(
        (t) =>
          t.active &&
          t.review === 'Approved' &&
          t.completedAt === null &&
          t.template.required,
      )
      return (
        !e.tasks.every((t) => t.completedAt !== null) &&
        (daysUntilStart < 7 || (hasOverdueRequired && hasBlockedRequired))
      )
    }).map((e) => ({
      id: e.id,
      name: e.user.name,
      startDate: e.startDate,
      plan: e.plan,
      department: e.department,
    }))

    res.json({
      totalOnboarding: employees.length,
      joiningCount,
      pendingApprovals,
      pendingTasks,
      overdueTasks,
      criticalBlockers,
      deptProgress,
      atRisk,
      openIssues: issues.length,
      escalatedIssues: issues.filter((i) => i.status === 'Escalated').length,
    })
  })
}
