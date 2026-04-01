import type Database from 'better-sqlite3'
import type { Topic, ConversationState, SendMessage } from '../types.js'

export async function sendWeekly(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<{ aborted: true } | { aborted: false; topic: Topic }> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState

  if (state.step !== 'idle') {
    await sendMessage(chatId, 'A review is already in progress. Finish it before sending a new topic.')
    return { aborted: true }
  }

  const eligible = db.prepare(`
    SELECT * FROM topics
    WHERE status = 'pending' OR (status = 'skipped' AND skip_count < 3)
  `).all() as Topic[]

  if (eligible.length === 0) {
    await sendMessage(chatId, 'No topics available to send. Add some ideas first!')
    return { aborted: true }
  }

  const topic = eligible[Math.floor(Math.random() * eligible.length)]
  const now = new Date().toISOString()

  db.prepare("UPDATE topics SET status = 'sent', sent_at = ? WHERE id = ?").run(now, topic.id)
  db.prepare('UPDATE conversation_state SET topic_id = ?, updated_at = ? WHERE id = 1').run(topic.id, now)

  const sent = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as Topic

  const lines = [
    `📚 <b>This week's topic:</b> ${sent.title}`,
    sent.category ? `🏷 Category: ${sent.category}` : null,
    sent.url ? `🔗 ${sent.url}` : null,
    '',
    "Good luck — I'll check in on Sunday! 🍪",
  ].filter((l): l is string => l !== null)

  await sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '⏭ Skip this topic', callback_data: 'skip_topic' }]],
    },
  })

  return { aborted: false, topic: sent }
}

export async function sendReviewPrompt(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<{ skipped: boolean }> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState
  if (!state.topic_id) return { skipped: true }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  await sendMessage(chatId, `⭐ Time to review <b>${topic.title}</b>! Let's go 👇\n\n<b>Step 1 of 4 — Pros</b>\nWhat did you like about it?`, { parse_mode: 'HTML' })

  db.prepare("UPDATE conversation_state SET step = 'awaiting_pros', updated_at = ? WHERE id = 1")
    .run(new Date().toISOString())

  return { skipped: false }
}

export async function sendReminder(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<{ skipped: boolean }> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState & { reminded_at: string | null }

  if (state.step !== 'awaiting_pros') return { skipped: true }
  if (state.reminded_at !== null) return { skipped: true }

  if (!state.updated_at) return { skipped: true }
  const updatedAt = new Date(state.updated_at).getTime()
  const fourHoursMs = 4 * 60 * 60 * 1000
  if (Date.now() - updatedAt < fourHoursMs) return { skipped: true }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  await sendMessage(chatId, `⏰ Hey! Don't forget to review this week's topic: <b>${topic.title}</b>. Tap /review to start! 🍪`, { parse_mode: 'HTML' })

  db.prepare('UPDATE conversation_state SET reminded_at = ? WHERE id = 1').run(new Date().toISOString())
  return { skipped: false }
}
