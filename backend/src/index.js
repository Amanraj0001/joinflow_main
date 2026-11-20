import { config } from './config.js'
import { PrismaClient } from '@prisma/client'
import { createApp } from './app.js'
const db = new PrismaClient()
await db.$connect()
const port = config.port
const server = createApp(db).listen(port, '0.0.0.0', () =>
  console.log('JoinFlow listening on port ' + port)
)
function close() {
  server.close(async () => {
    await db.$disconnect()
    process.exit()
  })
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
