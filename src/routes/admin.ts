import { Router } from 'express'
import type Database from 'better-sqlite3'
import { requireAdminSession, setSessionCookie } from '../admin/auth.js'
import { loginPage, ideasPage, adminLayout } from '../admin/views.js'
import { createIdeasService } from '../services/ideasService.js'

export function createAdminRouter(db: Database.Database, apiKey: string): Router {
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
    const topics = svc.list({ status: 'pending' }).concat(svc.list({ status: 'skipped' }))
    const flash = req.query.flash as string | undefined
    res.send(ideasPage(topics, flash))
  })

  router.post('/ideas', (req, res) => {
    const { title, category, description, url } = req.body as Record<string, string>
    if (!title) {
      res.redirect('/admin')
      return
    }
    const svc = createIdeasService(db)
    svc.create({ title, category, description, url })
    res.redirect('/admin')
  })

  router.get('/reviews', (_req, res) => {
    res.send(adminLayout('Reviews', 'reviews', '<h2>Reviews</h2>'))
  })

  return router
}
