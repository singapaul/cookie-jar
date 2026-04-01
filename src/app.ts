import express, { type Express } from 'express'
import type Database from 'better-sqlite3'
import { createIdeasRouter } from './routes/ideas.js'
import { createReviewsRouter } from './routes/reviews.js'
import { createWebhookRouter } from './webhook.js'

export function createApp(db: Database.Database | null, apiKey: string): Express {
  const app = express()
  app.use(express.json())

  if (db) {
    app.use('/telegram/webhook', createWebhookRouter(db))
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
