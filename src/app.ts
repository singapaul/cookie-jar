import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import type Database from 'better-sqlite3'
import { createIdeasRouter } from './routes/ideas.js'
import { createReviewsRouter } from './routes/reviews.js'
import { createWebhookRouter } from './webhook.js'
import { createAdminRouter } from './routes/admin.js'
import type { SendMessage } from './types.js'

export function createApp(db: Database.Database | null, apiKey: string, sendMessage?: SendMessage): Express {
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use(cookieParser(apiKey))

  if (db) {
    app.use('/telegram/webhook', createWebhookRouter(db))
    app.use('/admin', createAdminRouter(db, apiKey, sendMessage))
  }

  app.use((req, res, next) => {
    const auth = req.headers['authorization']
    if (!auth || auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  })

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  if (db) {
    app.use('/ideas', createIdeasRouter(db))
    app.use('/reviews', createReviewsRouter(db))
  }

  return app
}
