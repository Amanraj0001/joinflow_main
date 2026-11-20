import { sessionRoutes } from './auth/session.js'
import { assistantRoutes } from './knowledge/assistant.js'
import { onboardingRoutes } from './onboarding/routes.js'
import { overviewRoutes } from './workspace/overview.js'
import { publicAccounts, staffAccounts } from './auth/accounts.js'
import { planRoutes } from './onboarding/plans.js'
import { policyRoutes } from './knowledge/policies.js'
import { employeeRoutes } from './employee/services.js'
import { config } from './config.js'
import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import pino from 'pino'
import { HttpError } from './onboarding/workflow.js'

export function createApp(db, options = {}) {
  const app = express()
  const production = config.production
  const secret =
    config.jwtSecret || (!production && randomBytes(48).toString('hex'))
  if (
    !secret ||
    secret.length < 32 ||
    (production && secret.startsWith('replace-with'))
  )
    throw Error('Configure a random JWT_SECRET of at least 32 characters.')
  const key = new TextEncoder().encode(secret)
  const origin = config.origin
  const logger = pino({ level: config.logLevel })
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/',
  }
  app.disable('x-powered-by')
  app.use(
    '/api',
    (req, res, next) => {
      req.requestId = randomUUID()
      // Attach security headers and a unique request ID to every API response.
      res.set({
        'X-Request-ID': req.requestId,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      const start = Date.now()
      res.on('finish', () =>
        logger.info({
          requestId: req.requestId,
          route: req.route?.path,
          status: res.statusCode,
          latencyMs: Date.now() - start,
          ...res.locals.chat,
        })
      )
      // Block POST requests from origins not matching the configured ORIGIN env variable.
      // This covers both localhost and 127.0.0.1 in local development.
      if (req.method === 'POST' && req.headers.origin !== origin)
        return next(new HttpError(403, 'Request origin is not allowed.'))
      next()
    },
    express.json({ limit: '8mb' })
  )
  // Health check endpoint — verifies DB connectivity before responding.
  app.get('/api/health', async (req, res) => {
    await db.$queryRaw`SELECT 1`
    res.json({ ok: true })
  })
  publicAccounts(app, db)
  sessionRoutes(app, db, key, cookie)
  const role =
    (...roles) =>
    (req, res, next) =>
      roles.includes(req.user.role)
        ? next()
        : next(new HttpError(403, 'Your role cannot perform this action.'))
  staffAccounts(app, db, role)
  planRoutes(app, db, role)
  policyRoutes(app, db, role)
  employeeRoutes(app, db, role)
  app.get('/api/me', (req, res) => res.json(req.user))
  app.post('/api/auth/logout', (req, res) =>
    res.clearCookie('joinflow', cookie).json({ ok: true })
  )
  overviewRoutes(app, db, role)
  onboardingRoutes(app, db, role)
  assistantRoutes(app, db, role, options)
  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'Route not found.' })
  )
  app.use(express.static('dist'))
  app.get('/{*path}', (req, res) =>
    res.sendFile(path.resolve('dist/index.html'))
  )
  // Global error handler — maps known error types to HTTP status codes.
  // Handles Zod validation errors, Prisma constraint errors, and custom HttpErrors.
  app.use((err, req, res, next) => {
    const status =
      err instanceof z.ZodError
        ? 400
        : err.code === 'P2025'
          ? 404
          : err.code === 'P2002'
            ? 409
            : err.status || 500
    const message =
      err instanceof HttpError
        ? err.message
        : err instanceof z.ZodError
          ? 'Invalid ' + (err.issues[0].path.join('.') || 'request') + '.'
          : err.code === 'P2002'
            ? 'An account with this email already exists.'
            : status >= 500
              ? 'The server could not complete the request.'
              : 'Invalid request.'
    if (status >= 500)
      logger.error({
        requestId: req.requestId,
        errorType: err.name,
        code: err.code,
      })
    res.status(status).json({ error: message })
  })
  return app
}
