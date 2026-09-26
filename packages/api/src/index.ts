import { serve } from '@hono/node-server'
import { app, authCanonical } from './app.js'
import { runMigrations } from './db/migrate.js'

const port = Number(process.env.PORT ?? 3001)

async function bootstrap() {
  await runMigrations()
  serve({ fetch: app.fetch, port }, () => {
    console.log(`bandstr API running on http://localhost:${port} (auth: ${authCanonical})`)
  })
}

void bootstrap().catch((error) => {
  console.error('API startup failed', error)
  process.exit(1)
})

export type { AppType } from './app.js'
export { app }
