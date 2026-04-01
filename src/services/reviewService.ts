import type Database from 'better-sqlite3'
import type { ConversationState, SendMessage } from '../types.js'

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
    await sendMessage(chatId, "Got it! What were the cons?")
    return
  }

  if (state.step === 'awaiting_cons') {
    db.prepare("UPDATE conversation_state SET draft_cons = ?, step = 'awaiting_rating', updated_at = ? WHERE id = 1")
      .run(text, now)
    await sendMessage(chatId, "Thanks! Rate it 1–10.")
    return
  }

  if (state.step === 'awaiting_rating') {
    const rating = parseInt(text, 10)
    if (isNaN(rating) || rating < 1 || rating > 10) {
      await sendMessage(chatId, "Please enter a number between 1 and 10.")
      return
    }
    db.prepare("UPDATE conversation_state SET draft_rating = ?, step = 'awaiting_verdict', updated_at = ? WHERE id = 1")
      .run(rating, now)
    await sendMessage(chatId, "Almost done! What's your final verdict?")
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
      `Review saved! ✅\nPros: ${draft_pros}\nCons: ${draft_cons}\nRating: ${draft_rating}/10\nVerdict: ${text}`
    )
  }
}
