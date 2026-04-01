import { Router, type Request, type Response } from 'express'
import type Database from 'better-sqlite3'
import { handleMessage } from './services/reviewService.js'
import { sendMessage } from './telegram.js'

export function createWebhookRouter(db: Database.Database): Router {
  const router = Router()

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as { message?: { text?: string } }
    const text = body?.message?.text

    if (text) {
      const chatId = process.env.TELEGRAM_CHAT_ID ?? ''
      await handleMessage(db, sendMessage, chatId, text)
    }

    res.sendStatus(200)
  })

  return router
}
