import { Router } from 'express'
import type Database from 'better-sqlite3'
import { createReviewsService } from '../services/reviewsService.js'

export function createReviewsRouter(db: Database.Database): Router {
  const router = Router()
  const svc = createReviewsService(db)

  router.get('/', (req, res) => {
    const { category, min_rating } = req.query as Record<string, string | undefined>
    res.json(svc.list({ category, min_rating }))
  })

  router.get('/:id', (req, res) => {
    const review = svc.get(Number(req.params.id))
    if (!review) return res.status(404).json({ error: 'Not found' })
    res.json(review)
  })

  return router
}
