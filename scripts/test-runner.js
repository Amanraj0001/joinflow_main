import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { existsSync } from 'node:fs'
const browser = process.argv.includes('--browser')
const url = new URL(
  process.env.TEST_DATABASE_URL ||
    'postgresql://joinflow:local-demo@127.0.0.1:55439/joinflow_test'
)
const schema = 'test_' + randomUUID().replaceAll('-', '')
url.searchParams.set('schema', schema)
Object.assign(process.env, {
  DATABASE_URL: url.href,
  JWT_SECRET: 'temporary-test-secret-only-for-tests-12345',
  DEMO_PASSWORD: 'WelcomeDemo123!',
  APP_ORIGIN: 'http://127.0.0.1:4179',
  PORT: '4179',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  GROQ_API_KEY: '',
  SMTP_URL: '',
  EMBEDDINGS_URL: '',
})
const port = browser ? 18012 : 18011
const localPython =
  process.platform === 'win32'
    ? '.local/rag-env/Scripts/python.exe'
    : '.local/rag-env/bin/python'
const python =
  process.env.RAG_PYTHON || (existsSync(localPython) ? localPython : 'python')
process.env.RAG_URL = 'http://127.0.0.1:' + port
process.env.RAG_SECRET = randomUUID()
const retrieval = spawn(
  python,
  [
    '-m',
    'uvicorn',
    'services.rag.main:app',
    '--port',
    String(port),
    '--host',
    '127.0.0.1',
    '--log-level',
    'warning',
  ],
  { stdio: 'inherit', windowsHide: true }
)
let serviceError
retrieval.on('error', (err) => (serviceError = err))
const db = new PrismaClient()
function run(args) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (r.status !== 0) throw Error('Failed: ' + args.join(' '))
}
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serviceError) throw serviceError
    if (retrieval.exitCode !== null) throw Error('Test RAG service stopped.')
    try {
      ready = (
        await fetch(process.env.RAG_URL + '/health', {
          headers: { 'X-Service-Key': process.env.RAG_SECRET },
        })
      ).ok
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!ready) throw Error('The test RAG service did not start.')
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'])
  run(['prisma/seed.js'])
  run(
    browser
      ? ['node_modules/@playwright/test/cli.js', 'test']
      : ['node_modules/vitest/vitest.mjs', 'run']
  )
} finally {
  retrieval.kill()
  // The schema identifier is generated here and contains only a prefix and hex digits.
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE')
  await db.$disconnect()
}
