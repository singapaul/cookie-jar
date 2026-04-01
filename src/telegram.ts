import TelegramBot from 'node-telegram-bot-api'
import type Database from 'better-sqlite3'
import { handleStatus, handleSkip } from './services/botCommandsService.js'

let bot: TelegramBot | null = null

export function initBot(token: string, db: Database.Database): TelegramBot {
  if (bot) return bot
  const isProd = process.env.NODE_ENV === 'production'
  bot = new TelegramBot(token, { polling: !isProd })

  const chatId = process.env.TELEGRAM_CHAT_ID ?? ''

  bot.onText(/\/status/, () => handleStatus(db, sendMessage, chatId))
  bot.onText(/\/skip/, () => handleSkip(db, sendMessage, chatId))

  return bot
}

export function getBot(): TelegramBot | null {
  return bot
}

export function sendMessage(chatId: string, text: string): Promise<TelegramBot.Message> {
  if (!bot) throw new Error('Bot not initialised')
  return bot.sendMessage(chatId, text)
}
