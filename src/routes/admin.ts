import { Router } from 'express'
import type Database from 'better-sqlite3'
import { requireAdminSession, setSessionCookie } from '../admin/auth.js'
import { loginPage, ideasPage, reviewsPage, exportPage } from '../admin/views.js'
import { createIdeasService } from '../services/ideasService.js'
import { createReviewsService } from '../services/reviewsService.js'
import { sendWeekly, sendReviewPrompt, sendReminder } from '../services/schedulerService.js'
import { sendMessage as telegramSendMessage } from '../telegram.js'
import type { SendMessage } from '../types.js'

const PAGE_SIZE = 20

export function createAdminRouter(
  db: Database.Database,
  apiKey: string,
  sendMessage: SendMessage = telegramSendMessage
): Router {
  const router = Router()

  router.get('/login', (_req, res) => {
    res.send(loginPage())
  })

  router.post('/login', (req, res) => {
    const { password } = req.body as { password: string }
    if (password !== apiKey) {
      res.send(loginPage('Invalid password.'))
      return
    }
    setSessionCookie(res, apiKey)
    res.redirect('/admin')
  })

  router.use(requireAdminSession)

  router.get('/', (req, res) => {
    const svc = createIdeasService(db)
    const search = req.query.search as string | undefined
    const category = req.query.category as string | undefined
    const page = Number(req.query.page ?? 1)

    const totalActive =
      svc.count({ status: 'pending', search, category }) +
      svc.count({ status: 'skipped', search, category }) +
      svc.count({ status: 'sent', search, category }) +
      svc.count({ status: 'reviewed', search, category })

    const offset = (page - 1) * PAGE_SIZE

    const topics = [
      ...svc.list({ status: 'sent', search, category }),
      ...svc.list({ status: 'pending', search, category, limit: PAGE_SIZE, offset }),
      ...svc.list({ status: 'skipped', search, category, limit: PAGE_SIZE, offset }),
      ...svc.list({ status: 'reviewed', search, category }),
      ...svc.list({ status: 'archived', search, category }),
    ]

    const flash = req.query.flash as string | undefined
    const stats = svc.getStats()
    res.send(ideasPage(topics, flash, stats, search, category, page, totalActive, PAGE_SIZE))
  })

  router.post('/ideas', (req, res) => {
    const { title, category, description, url } = req.body as Record<string, string>
    if (!title) { res.redirect('/admin'); return }
    createIdeasService(db).create({ title, category, description, url })
    res.redirect('/admin')
  })

  router.post('/ideas/:id/edit', (req, res) => {
    const { title, category, description, url } = req.body as Record<string, string>
    createIdeasService(db).update(Number(req.params.id), { title, category, description, url })
    res.redirect('/admin')
  })

  router.post('/ideas/:id/delete', (req, res) => {
    createIdeasService(db).remove(Number(req.params.id))
    res.redirect('/admin')
  })

  router.post('/ideas/:id/skip', (req, res) => {
    createIdeasService(db).skip(Number(req.params.id))
    res.redirect('/admin')
  })

  router.post('/ideas/:id/reset', (req, res) => {
    const id = Number(req.params.id)
    const result = createIdeasService(db).resetToPending(id)
    if (!('error' in result)) {
      // Clear conversation state if this was the active topic
      db.prepare("UPDATE conversation_state SET topic_id = NULL, step = 'idle', updated_at = ? WHERE topic_id = ?")
        .run(new Date().toISOString(), id)
    }
    res.redirect('/admin')
  })

  router.post('/send-weekly', async (_req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
    const result = await sendWeekly(db, sendMessage, chatId)
    const flash = result.aborted ? 'Could not send — check bot state or topic pool.' : 'Topic sent to Telegram!'
    res.redirect(`/admin?flash=${encodeURIComponent(flash)}`)
  })

  router.post('/send-review-prompt', async (_req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
    const result = await sendReviewPrompt(db, sendMessage, chatId)
    const flash = result.skipped ? 'No active topic to review.' : 'Review prompt sent to Telegram!'
    res.redirect(`/admin?flash=${encodeURIComponent(flash)}`)
  })

  router.post('/send-reminder', async (_req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
    const result = await sendReminder(db, sendMessage, chatId)
    const flash = result.skipped ? 'No reminder needed (not in review window or already sent).' : 'Reminder sent!'
    res.redirect(`/admin?flash=${encodeURIComponent(flash)}`)
  })

  router.get('/ideas/export.json', (_req, res) => {
    const topics = createIdeasService(db).list({})
    res.setHeader('Content-Disposition', 'attachment; filename="ideas.json"')
    res.json(topics)
  })

  router.get('/export', (_req, res) => {
    const topics = createIdeasService(db).list({})
    const reviews = createReviewsService(db).list({})
    res.send(exportPage({ topics, reviews }))
  })

  router.get('/reviews/export.csv', (_req, res) => {
    const reviews = createReviewsService(db).list({}) as Record<string, unknown>[]
    const headers = ['id', 'topic_id', 'title', 'category', 'rating', 'pros', 'cons', 'verdict', 'reviewed_at']
    const rows = reviews.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="reviews.csv"')
    res.send(csv)
  })

  router.get('/reviews/export.json', (_req, res) => {
    const reviews = createReviewsService(db).list({})
    res.setHeader('Content-Disposition', 'attachment; filename="reviews.json"')
    res.json(reviews)
  })

  router.post('/reviews/:id/edit', (req, res) => {
    const { pros, cons, rating, verdict } = req.body as Record<string, string>
    createReviewsService(db).update(Number(req.params.id), {
      pros, cons, verdict, rating: rating ? Number(rating) : undefined,
    })
    res.redirect('/admin/reviews')
  })

  router.post('/reviews/:id/delete', (req, res) => {
    createReviewsService(db).remove(Number(req.params.id))
    res.redirect('/admin/reviews')
  })

  router.get('/reviews', (req, res) => {
    const svc = createReviewsService(db)
    const page = Number(req.query.page ?? 1)
    const total = svc.count({})
    const offset = (page - 1) * PAGE_SIZE
    const reviews = svc.list({ limit: PAGE_SIZE, offset })
    res.send(reviewsPage(reviews as Parameters<typeof reviewsPage>[0], page, total, PAGE_SIZE))
  })

  return router
}
