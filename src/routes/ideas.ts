import { Router } from 'express'
import type Database from 'better-sqlite3'
import { createIdeasService } from '../services/ideasService.js'
import { sendWeekly, sendReviewPrompt } from '../services/schedulerService.js'
import { sendMessage } from '../telegram.js'

export function createIdeasRouter(db: Database.Database): Router {
  const router = Router()
  const svc = createIdeasService(db)

  router.post('/', (req, res) => {
    const { title, description, category, url } = req.body as Record<string, string>
    if (!title) return res.status(400).json({ error: 'title is required' })
    const topic = svc.create({ title, description, category, url })
    res.status(201).json(topic)
  })

  router.get('/', (req, res) => {
    const { category, status } = req.query as Record<string, string | undefined>
    res.json(svc.list({ category, status }))
  })

  router.patch('/:id', (req, res) => {
    const result = svc.update(Number(req.params.id), req.body)
    if ('error' in result && result.error === 'not_found') return res.status(404).json({ error: 'Not found' })
    if ('error' in result && result.error === 'forbidden') return res.status(403).json({ error: 'Topic is not pending' })
    res.json(result)
  })

  router.delete('/:id', (req, res) => {
    const result = svc.remove(Number(req.params.id))
    if ('error' in result && result.error === 'not_found') return res.status(404).json({ error: 'Not found' })
    if ('error' in result && result.error === 'forbidden') return res.status(403).json({ error: 'Topic is not pending' })
    res.status(204).end()
  })

  router.post('/:id/skip', (req, res) => {
    const result = svc.skip(Number(req.params.id))
    if ('error' in result && result.error === 'not_found') return res.status(404).json({ error: 'Not found' })
    res.json(result)
  })

  router.post('/send-weekly', async (_req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
    const result = await sendWeekly(db, sendMessage, chatId)
    if (result.aborted) return res.status(409).json({ aborted: true })
    res.json({ topic: result.topic })
  })

  router.post('/send-review-prompt', async (_req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
    const result = await sendReviewPrompt(db, sendMessage, chatId)
    res.json(result)
  })

  return router
}
