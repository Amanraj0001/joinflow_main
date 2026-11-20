import { z } from 'zod'
import { chat } from './chat.js'
import { HttpError } from '../onboarding/workflow.js'

export function assistantRoutes(app, db, role, options) {
  const question = z
    .object({ question: z.string().trim().min(1).max(1000) })
    .strict()
  app.get('/api/chat', role('Employee'), async (req, res) => {
    const turns = await db.chatTurn.findMany({
      where: { employeeId: req.user.profile.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    res.json(
      turns
        .reverse()
        .map((t) => ({ id: t.id, question: t.question, ...t.answer })),
    )
  })
  app.post('/api/chat', role('Employee'), async (req, res) => {
    const prompt = question.parse(req.body).question
    let context = prompt
    if (
      /\b(that|those|it|them|this|they)\b|^(and |tell me more|why\??$)/i.test(
        prompt,
      )
    ) {
      const previous = await db.chatTurn.findFirst({
        where: { employeeId: req.user.profile.id },
        orderBy: { createdAt: 'desc' },
      })
      if (previous)
        context =
          prompt +
          '\nPrevious topic: ' +
          (previous.answer.evidence?.[0]?.title || previous.question)
    }
    const result = await chat(db, req.user.profile.id, context, options.chat)
    res.locals.chat = {
      outcome: result.mode,
      evidenceIds: result.evidence.map((e) => e.id),
    }
    const turn = await db.chatTurn.create({
      data: {
        employeeId: req.user.profile.id,
        question: prompt,
        answer: result,
      },
    })
    res.json({ ...result, id: turn.id })
  })
  // Human handoff escalation: allows employees to forward unresolved questions to HR
  app.post('/api/handoffs', role('Employee'), async (req, res) => {
    const v = question.extend({ turnId: z.string().optional() }).parse(req.body)
    const employeeId = req.user.profile.id
    const id = await db.$transaction(async (tx) => {
      if (v.turnId) {
        await tx.$queryRaw`SELECT id FROM "ChatTurn" WHERE id=${v.turnId} AND "employeeId"=${employeeId} FOR UPDATE`
        const turn = await tx.chatTurn.findFirstOrThrow({
          where: { id: v.turnId, employeeId },
        })
        if (turn.answer.handoffId) return turn.answer.handoffId
        if (!turn.answer.escalate || turn.question !== v.question)
          throw new HttpError(409, 'Question cannot be forwarded.')
        const item = await tx.handoff.create({
          data: { employeeId, question: v.question },
        })
        await tx.chatTurn.update({
          where: { id: turn.id },
          data: { answer: { ...turn.answer, sent: true, handoffId: item.id } },
        })
        return item.id
      }
      return (
        await tx.handoff.create({ data: { employeeId, question: v.question } })
      ).id
    })
    res.status(201).json({ id })
  })
  app.post('/api/handoffs/:id/reply', role('HR'), async (req, res) => {
    const { answer } = z
      .object({ answer: z.string().trim().min(1).max(4000) })
      .strict()
      .parse(req.body)
    const id = req.params.id
    const { count } = await db.handoff.updateMany({
      where: { id, answeredAt: null },
      data: { answer, answeredAt: new Date(), answeredBy: req.user.name },
    })
    if (!count) {
      if (
        !(await db.handoff.findUnique({ where: { id }, select: { id: true } }))
      )
        throw new HttpError(404, 'Question not found.')
      throw new HttpError(
        409,
        'This question already has an answer. Refresh to read it.',
      )
    }
    res.json({ ok: true })
  })
}
