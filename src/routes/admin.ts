import { Router } from 'express'
import type Database from 'better-sqlite3'
import { requireAdminSession, setSessionCookie } from '../admin/auth.js'
import { loginPage, ideasPage, reviewsPage } from '../admin/views.js'
import { createIdeasService } from '../services/ideasService.js'
import { createReviewsService } from '../services/reviewsService.js'
import { sendWeekly, sendReviewPrompt } from '../services/schedulerService.js'
import { sendMessage as telegramSendMessage } from '../telegram.js'
import type { SendMessage } from '../types.js'

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
    const topics = [
      ...svc.list({ status: 'pending' }),
      ...svc.list({ status: 'skipped' }),
      ...svc.list({ status: 'archived' }),
    ]
    const flash = req.query.flash as string | undefined
    res.send(ideasPage(topics, flash))
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

  router.get('/reviews', (_req, res) => {
    const reviews = createReviewsService(db).list({})
    res.send(reviewsPage(reviews as Parameters<typeof reviewsPage>[0]))
  })

  return router
}
