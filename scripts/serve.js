import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const dev = process.argv.includes('--dev')
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', (err) => {
    console.error(err.message)
    stop(1)
  })
  child.on('exit', (code) => stop(code ?? 0))
}
if (!process.env.RAG_URL || process.env.RAG_URL === 'http://127.0.0.1:8010') {
  const local =
    process.platform === 'win32'
      ? '.local/rag-env/Scripts/python.exe'
      : '.local/rag-env/bin/python'
  const python =
    process.env.RAG_PYTHON ||
    (existsSync(local)
      ? local
      : process.platform === 'win32'
        ? 'python'
        : 'python3')
  run(python, [
    '-m',
    'uvicorn',
    'main:app',
    '--app-dir',
    'ml-services',
    '--host',
    '127.0.0.1',
    '--port',
    '8010',
  ])
}
run(process.execPath, [...(dev ? ['--watch'] : []), 'backend/src/index.js'])
if (dev) run(process.execPath, ['node_modules/vite/bin/vite.js'])
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
