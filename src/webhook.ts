import { Router, type Request, type Response } from 'express'
import type Database from 'better-sqlite3'
import { handleMessage, handleCallbackQuery } from './services/reviewService.js'
import { handleStatus, handleSkip, handleHelp, handleTopic, handleReview, handleHistory, handleIdea } from './services/botCommandsService.js'
import { answerCallbackQuery, sendMessage as telegramSendMessage } from './telegram.js'
import type { SendMessage } from './types.js'

export function createWebhookRouter(db: Database.Database, sendMessage: SendMessage = telegramSendMessage): Router {
  const router = Router()

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as {
      message?: { text?: string }
      callback_query?: { id: string; data?: string }
    }
    const chatId = process.env.TELEGRAM_CHAT_ID ?? ''

    if (body.message?.text) {
      const text = body.message.text
      if (text === '/help' || text.startsWith('/help ')) await handleHelp(db, sendMessage, chatId)
      else if (text === '/status' || text.startsWith('/status ')) await handleStatus(db, sendMessage, chatId)
      else if (text === '/skip' || text.startsWith('/skip ')) await handleSkip(db, sendMessage, chatId)
      else if (text === '/topic' || text.startsWith('/topic ')) await handleTopic(db, sendMessage, chatId)
      else if (text === '/review' || text.startsWith('/review ')) await handleReview(db, sendMessage, chatId)
      else if (text === '/history' || text.startsWith('/history ')) await handleHistory(db, sendMessage, chatId)
      else if (text.startsWith('/idea')) await handleIdea(db, sendMessage, chatId, text)
      else await handleMessage(db, sendMessage, chatId, text)
    }

    if (body.callback_query) {
      await answerCallbackQuery(body.callback_query.id)
      if (body.callback_query.data) {
        await handleCallbackQuery(db, sendMessage, chatId, body.callback_query.data)
      }
    }

    res.sendStatus(200)
  })

  return router
}
