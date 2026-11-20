import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { HttpError, safeUser } from '../onboarding/workflow.js'

export function sessionRoutes(app, db, key, cookie) {
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(128),
      })
      .strict()
      .parse(req.body)
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!user || !(await bcrypt.compare(password, user.hash)))
      throw new HttpError(401, 'Email or password is incorrect.')
    if (!user.verified)
      throw new HttpError(
        403,
        'Your registration is awaiting manager approval.'
      )
    const token = await new SignJWT({ version: user.sessionVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('joinflow')
      .setAudience('workspace')
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(key)
    res
      .cookie('joinflow', token, { ...cookie, maxAge: 8 * 3600000 })
      .json({ ok: true })
  })
  // Session validation middleware — runs on every /api route after login.
  // Extracts JWT from HttpOnly cookie, verifies signature, and attaches req.user.
  app.use('/api', async (req, res, next) => {
    const token = req.headers.cookie
      ?.split(/;\s*/)
      .find((c) => c.startsWith('joinflow='))
      ?.slice(9)
    let claims
    try {
      claims = (
        await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: 'joinflow',
          audience: 'workspace',
        })
      ).payload
    } catch {
      throw new HttpError(401, 'Please sign in.')
    }
    req.user = await db.user.findUnique({
      where: { id: claims.sub },
      select: {
        ...safeUser,
        verified: true,
        sessionVersion: true,
        profile: { select: { id: true } },
      },
    })
    if (
      !req.user?.verified ||
      req.user.sessionVersion !== (claims.version || 0)
    )
      throw new HttpError(401, 'Please sign in.')
    next()
  })
}
