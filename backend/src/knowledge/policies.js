import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { rag } from './retrieval.js'
import { HttpError } from '../onboarding/workflow.js'
const optional = z.string().trim().max(100).optional()
const source = z
  .object({
    title: z.string().trim().min(1).max(160),
    text: z.string().max(150000).default(''),
    pdf: z.string().max(7000000).optional(),
    description: z.string().trim().max(2000).optional(),
    category: optional,
    effectiveDate: z.union([z.iso.date(), z.literal('')]).optional(),
    ownerId: z.string().min(1).optional(),
    department: optional,
    job: optional,
    location: optional,
    mode: z.enum(['append', 'replace', 'reindex']).default('replace'),
    version: z.number().int().optional(),
  })
  .strict()
export function policyRoutes(app, db, role) {
  app.get('/api/policies', role('Manager', 'HR'), async (req, res) => {
    const [rows, managers] = await Promise.all([
      db.policy.findMany({
        where: { archived: false },
        omit: { chunks: true, sourcePdf: true, sourceText: true },
        orderBy: { title: 'asc' },
      }),
      db.user.findMany({
        where: { verified: true, role: 'Manager' },
        select: { id: true, name: true },
      }),
    ])
    res.json(
      rows.map((p) => ({
        ...p,
        owner: managers.find((m) => m.id === p.ownerId)?.name || 'Unassigned',
      })),
    )
  })
  async function publish(req, v, id, suggestionId) {
    const old = id ? await db.policy.findUniqueOrThrow({ where: { id } }) : null
    const ownerId = v.ownerId || old?.ownerId || req.user.id
    await db.user.findFirstOrThrow({
      where: { id: ownerId, role: 'Manager', verified: true },
    })
    if (old?.ownerId && old.ownerId !== req.user.id)
      throw new HttpError(403, 'Only the owning manager can edit this policy.')
    if (old && (old.archived || old.version !== v.version))
      throw new HttpError(409, 'Refresh the policy version.')
    if (v.mode === 'reindex' && !old)
      throw new HttpError(400, 'Select an existing policy to reindex.')
    const pdf =
      v.mode === 'reindex'
        ? old?.sourcePdf
        : v.pdf
          ? Buffer.from(v.pdf, 'base64')
          : null
    if (pdf && pdf.subarray(0, 5).toString() !== '%PDF-')
      throw new HttpError(400, 'Select a PDF file.')
    const text =
      v.mode === 'reindex'
        ? (old.sourceText ?? old.body)
        : (v.mode === 'append' ? (old?.body || '') + '\n' : '') + v.text
    let indexed,
      processing = 'Ready'
    try {
      indexed = await rag('/index', {
        title: v.title,
        text,
        pdf: pdf?.toString('base64'),
      })
    } catch {
      processing = 'Failed'
      indexed = { text, chunks: [] }
    }
    const data = {
      title: v.title,
      body: indexed.text.slice(0, 150000),
      sourceText: text,
      sourcePdf: pdf,
      processing,
      chunks: indexed.chunks,
      approved: processing === 'Ready',
      ownerId,
      description: v.description ?? old?.description,
      effectiveDate: v.effectiveDate ?? old?.effectiveDate,
      category: v.category ?? old?.category,
      modifiedBy: req.user.name,
      department: v.department || null,
      location: v.location || null,
      job: v.job || null,
    }
    if (suggestionId && processing !== 'Ready')
      throw new HttpError(
        422,
        'Processing failed. The suggestion is still pending.',
      )
    const policyId = id || randomUUID()
    await db.$transaction(async (tx) => {
      if (old) {
        const {
          sourcePdf,
          sourceText,
          chunks,
          revisions,
          updatedAt,
          ...snapshot
        } = old
        const r = await tx.policy.updateMany({
          where: { id, version: v.version, archived: false },
          data: {
            ...data,
            revisions: [
              ...revisions,
              { ...snapshot, updatedAt: updatedAt?.toISOString() || null },
            ],
            version: { increment: 1 },
          },
        })
        if (!r.count)
          throw new HttpError(409, 'Policy changed during processing.')
      } else
        await tx.policy.create({ data: { ...data, id: policyId, version: 1 } })
      if (suggestionId)
        await tx.policySuggestion.update({
          where: { id: suggestionId, status: 'Pending' },
          data: { status: 'Approved' },
        })
    })
    return { id: policyId, processing }
  }
  async function manage(req, res) {
    res.json(await publish(req, source.parse(req.body), req.params.id))
  }
  app.post('/api/policies', role('Manager'), manage)
  app.post('/api/policies/:id/edit', role('Manager'), manage)
  app.post('/api/policies/:id/remove', role('Manager'), async (req, res) => {
    const { version } = z.object({ version: z.number().int() }).parse(req.body)
    const r = await db.policy.updateMany({
      where: {
        id: req.params.id,
        version,
        archived: false,
        OR: [{ ownerId: null }, { ownerId: req.user.id }],
      },
      data: { archived: true, approved: false, version: { increment: 1 } },
    })
    if (!r.count)
      throw new HttpError(
        409,
        'Policy is unavailable or owned by another manager.',
      )
    res.json({ ok: true })
  })
  app.post('/api/policies/:id/suggest', role('HR'), async (req, res) => {
    const { body } = z
      .object({ body: z.string().trim().min(1).max(3000) })
      .parse(req.body)
    await db.policy.findFirstOrThrow({
      where: { id: req.params.id, archived: false },
    })
    res.status(201).json(
      await db.policySuggestion.create({
        data: { policyId: req.params.id, author: req.user.name, body },
      }),
    )
  })
  app.post('/api/suggestions/:id/review', role('Manager'), async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['Approved', 'Reviewed', 'Declined']) })
      .parse(req.body)
    const s = await db.policySuggestion.findUniqueOrThrow({
      where: { id: req.params.id },
    })
    const policy = await db.policy.findFirstOrThrow({
      where: {
        archived: false,
        id: s.policyId,
        OR: [{ ownerId: null }, { ownerId: req.user.id }],
      },
    })
    if (status === 'Approved') {
      if (req.body.version !== policy.version)
        throw new HttpError(409, 'Refresh the policy before publishing.')
      return res.json(
        await publish(
          req,
          { ...policy, text: s.body, mode: 'append' },
          policy.id,
          s.id,
        ),
      )
    }
    await db.policySuggestion.update({
      where: { id: s.id, status: 'Pending' },
      data: { status },
    })
    res.json({ ok: true })
  })
}
