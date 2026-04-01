import type Database from 'better-sqlite3'
import type { ConversationState, SendMessage } from '../types.js'
import { handleSkip } from './botCommandsService.js'

export async function handleMessage(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string,
  text: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState
  const now = new Date().toISOString()

  if (state.step === 'idle') return

  if (state.step === 'awaiting_pros') {
    db.prepare("UPDATE conversation_state SET draft_pros = ?, step = 'awaiting_cons', updated_at = ? WHERE id = 1")
      .run(text, now)
    await sendMessage(chatId, 'Nice! 📝\n\n<b>Step 2 of 4 — Cons</b>\nWhat were the downsides?', { parse_mode: 'HTML' })
    return
  }

  if (state.step === 'awaiting_cons') {
    db.prepare("UPDATE conversation_state SET draft_cons = ?, step = 'awaiting_rating', updated_at = ? WHERE id = 1")
      .run(text, now)
    await sendMessage(chatId, 'Got it! 🤔\n\n<b>Step 3 of 4 — Rating</b>\nHow would you rate it?', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [1, 2, 3, 4, 5].map(n => ({ text: String(n), callback_data: `rating:${n}` })),
          [6, 7, 8, 9, 10].map(n => ({ text: String(n), callback_data: `rating:${n}` })),
        ],
      },
    })
    return
  }

  if (state.step === 'awaiting_rating') {
    const rating = parseInt(text, 10)
    if (isNaN(rating) || rating < 1 || rating > 10) {
      await sendMessage(chatId, '<b>Please enter a number between 1 and 10.</b>', { parse_mode: 'HTML' })
      return
    }
    db.prepare("UPDATE conversation_state SET draft_rating = ?, step = 'awaiting_verdict', updated_at = ? WHERE id = 1")
      .run(rating, now)
    await sendMessage(chatId, `<b>Step 4 of 4 — Verdict</b>\nWhat's your final take on it? 🏁`, { parse_mode: 'HTML' })
    return
  }

  if (state.step === 'awaiting_verdict') {
    const { topic_id, draft_pros, draft_cons, draft_rating } = state

    db.prepare(`
      INSERT INTO reviews (topic_id, pros, cons, rating, verdict, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(topic_id, draft_pros, draft_cons, draft_rating, text, now)

    db.prepare("UPDATE topics SET status = 'reviewed' WHERE id = ?").run(topic_id)
    db.prepare("UPDATE conversation_state SET step = 'idle', topic_id = NULL, draft_pros = NULL, draft_cons = NULL, draft_rating = NULL, updated_at = ? WHERE id = 1")
      .run(now)

    await sendMessage(
      chatId,
      `✅ <b>Review saved!</b>\n\n<b>Pros:</b> ${draft_pros}\n<b>Cons:</b> ${draft_cons}\n<b>Rating:</b> ${draft_rating}/10\n<b>Verdict:</b> ${text}`,
      { parse_mode: 'HTML' }
    )
  }
}

export async function handleCallbackQuery(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string,
  data: string
): Promise<void> {
  if (data.startsWith('rating:')) {
    const rating = parseInt(data.split(':')[1], 10)
    if (isNaN(rating) || rating < 1 || rating > 10) return
    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState
    if (state.step !== 'awaiting_rating') return
    const now = new Date().toISOString()
    db.prepare("UPDATE conversation_state SET draft_rating = ?, step = 'awaiting_verdict', updated_at = ? WHERE id = 1").run(rating, now)
    await sendMessage(chatId, `<b>Step 4 of 4 — Verdict</b>\nWhat's your final take on it? 🏁`, { parse_mode: 'HTML' })
  }
  if (data === 'skip_topic') {
    await handleSkip(db, sendMessage, chatId)
  }
}
