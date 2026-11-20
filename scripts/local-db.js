import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
const databaseDir = path.resolve('.local/postgres')
mkdirSync(path.dirname(databaseDir), { recursive: true })
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'joinflow',
  password: 'local-demo',
  port: 55439,
  persistent: true,
  initdbFlags: ['--encoding=UTF8'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
})
if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise()
await pg.start()
const client = pg.getPgClient()
await client.connect()
for (const name of ['joinflow', 'joinflow_test']) {
  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname=$1',
    [name]
  )
  if (!rowCount) await pg.createDatabase(name)
}
await client.end()
console.log(
  'Local PostgreSQL ready on 127.0.0.1:55439. Keep this terminal open.'
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await pg.stop()
    process.exit()
  })
