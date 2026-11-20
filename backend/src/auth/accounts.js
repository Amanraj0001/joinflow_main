import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError } from '../onboarding/workflow.js'
const digest = (t) => createHash('sha256').update(t).digest('hex')

/**
 * Sends a password-setup or reset email to the given personal email address.
 * In development (no SMTP), writes the mail payload to .local/mail/ as JSON.
 * @returns {Promise<boolean>} true if mail was sent or saved, false on failure.
 */
export async function sendAccess(db, user, personalEmail, welcome = false) {
  if (!personalEmail) return false
  const token = randomBytes(32).toString('hex')
  const resetHash = digest(token)
  await db.user.update({
    where: { id: user.id },
    data: {
      resetHash,
      resetExpires: new Date(Date.now() + (welcome ? 24 : 1) * 3600000),
    },
  })
  const mail = {
    from: config.from,
    to: personalEmail,
    subject: welcome ? 'Your JoinFlow account' : 'Reset your JoinFlow password',
    text:
      'Your sign-in email is ' +
      user.email +
      '. Choose your password using this single-use link: ' +
      config.origin +
      '/#reset=' +
      token,
  }
  try {
    if (config.smtp)
      await nodemailer.createTransport(config.smtp).sendMail(mail)
    else if (!config.production) {
      await mkdir('.local/mail', { recursive: true })
      await writeFile(
        '.local/mail/' + randomUUID() + '.json',
        JSON.stringify(mail),
        { mode: 0o600 }
      )
    } else throw Error('SMTP not configured')
    return true
  } catch {
    return false
  }
}
export function publicAccounts(app, db) {
  // Registration endpoint — creates Manager or HR accounts pending manager approval.
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role, department } = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.email(),
        password: z.string().min(10).max(72),
        role: z.enum(['Manager', 'HR']),
        department: z
          .enum(['IT', 'People', 'Finance', 'Facilities'])
          .default('People'),
      })
      .strict()
      .parse(req.body)
    await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        hash: await bcrypt.hash(password, 12),
        role,
        department,
        verified: false,
      },
    })
    res.status(201).json({ ok: true })
  })
  // Forgot password — silently succeeds even if email not found (prevents user enumeration).
  app.post('/api/auth/forgot', async (req, res) => {
    const { email } = z.object({ email: z.email() }).parse(req.body)
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true },
    })
    if (user?.role === 'Employee' && user.profile?.personalEmail)
      await sendAccess(db, user, user.profile.personalEmail)
    res.json({ ok: true })
  })
  // Reset password — validates token hash and expiry before allowing password change.
  // Reset token expires in 1 hour; welcome tokens expire in 24 hours.
  app.post('/api/auth/reset', async (req, res) => {
    const { token, password } = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(10).max(72),
      })
      .parse(req.body)
    const result = await db.user.updateMany({
      where: {
        resetHash: digest(token),
        resetExpires: { gt: new Date() },
        role: 'Employee',
      },
      data: {
        hash: await bcrypt.hash(password, 12),
        resetHash: null,
        resetExpires: null,
        sessionVersion: { increment: 1 },
      },
    })
    if (!result.count)
      throw new HttpError(400, 'This link has expired or was already used.')
    res.json({ ok: true })
  })
}
// Staff account management — approval/rejection of HR and Manager registrations.
export function staffAccounts(app, db, role) {
  // Only a Manager can approve or reject HR/Manager registrations.
  app.post('/api/registrations/:id', role('Manager'), async (req, res) => {
    const { decision } = z
      .object({ decision: z.enum(['Approve', 'Reject']) })
      .parse(req.body)
    const where = {
      id: req.params.id,
      verified: false,
      role: { in: ['HR', 'Manager'] },
    }
    const updated =
      decision === 'Approve'
        ? await db.user.updateMany({ where, data: { verified: true } })
        : await db.user.deleteMany({ where })
    if (!updated.count)
      throw new HttpError(409, 'Registration already reviewed.')
    res.json({ ok: true })
  })
  // HR can resend the welcome email with a new single-use invite link.
  app.post('/api/employees/:id/invite', role('HR'), async (req, res) => {
    const p = await db.employee.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { user: true },
    })
    if (!(await sendAccess(db, p.user, p.personalEmail, true)))
      throw new HttpError(
        503,
        'Check personal email and SMTP settings, then retry delivery.'
      )
    res.json({ ok: true })
  })
}
