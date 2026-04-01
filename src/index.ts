import 'dotenv/config'
import pino from 'pino'
import { createDb } from './db.js'
import { createApp } from './app.js'
import { initBot } from './telegram.js'

const logger = pino()

const db = createDb(process.env.DB_PATH ?? './dev.sqlite')
const app = createApp(db, process.env.API_KEY ?? '')

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'placeholder') {
  await initBot(process.env.TELEGRAM_BOT_TOKEN, db)
  logger.info('Telegram bot initialised')
}

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  logger.info({ port }, 'Server started')
})
