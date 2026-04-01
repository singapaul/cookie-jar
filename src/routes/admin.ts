import { Router } from 'express'
import type Database from 'better-sqlite3'
import { requireAdminSession, setSessionCookie } from '../admin/auth.js'
import { loginPage, adminLayout } from '../admin/views.js'

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

  router.get('/', (_req, res) => {
    res.send(adminLayout('Ideas', 'ideas', '<h2>Ideas</h2>'))
  })

  router.get('/reviews', (_req, res) => {
    res.send(adminLayout('Reviews', 'reviews', '<h2>Reviews</h2>'))
  })

  return router
}
