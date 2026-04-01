import type Database from 'better-sqlite3'
import type { Topic, ConversationState, SendMessage } from '../types.js'

export async function handleHelp(
  _db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  await sendMessage(
    chatId,
    `🍪 <b>Cookie Jar Bot</b>\n\n/help — Show this message\n/topic — See this week's topic\n/review — Start reviewing this week's topic\n/skip — Skip the current topic\n/status — Check the current step\n/history — See your last 5 reviews\n/idea Title | Category | URL — Save a new idea`,
    { parse_mode: 'HTML' }
  )
}

export async function handleStatus(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState

  if (!state.topic_id) {
    await sendMessage(chatId, 'No active topic. Use POST /ideas/send-weekly to send one.')
    return
  }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  await sendMessage(chatId, `Current topic: ${topic.title}\nStep: ${state.step}`)
}

export async function handleSkip(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState

  if (!state.topic_id) {
    await sendMessage(chatId, 'No active topic to skip.')
    return
  }

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  const newCount = (topic.skip_count ?? 0) + 1
  const newStatus = newCount >= 3 ? 'archived' : 'skipped'

  db.prepare('UPDATE topics SET skip_count = ?, status = ? WHERE id = ?')
    .run(newCount, newStatus, topic.id)
  db.prepare("UPDATE conversation_state SET topic_id = NULL, step = 'idle', updated_at = ? WHERE id = 1")
    .run(new Date().toISOString())

  await sendMessage(chatId, `Topic "${topic.title}" skipped (${newCount}/3).`)
}

export async function handleTopic(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState
  if (!state.topic_id) {
    await sendMessage(chatId, 'No active topic right now. Check the admin panel to send one.')
    return
  }
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  const daysSince = topic.sent_at ? Math.floor((Date.now() - new Date(topic.sent_at).getTime()) / 86400000) : null
  const lines = [
    `📚 <b>Current topic:</b> ${topic.title}`,
    topic.category ? `🏷 Category: ${topic.category}` : null,
    topic.url ? `🔗 ${topic.url}` : null,
    daysSince !== null ? `📅 Sent ${daysSince} day${daysSince === 1 ? '' : 's'} ago` : null,
  ].filter((l): l is string => l !== null)
  await sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' })
}

export async function handleReview(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as ConversationState
  if (!state.topic_id) {
    await sendMessage(chatId, 'No active topic to review. Send a topic first from the admin panel.')
    return
  }
  if (state.step !== 'idle') {
    await sendMessage(chatId, 'A review is already in progress! Just keep answering the questions.')
    return
  }
  // Inline sendReviewPrompt logic to avoid circular import with schedulerService
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(state.topic_id) as Topic
  await sendMessage(chatId, `⭐ Time to review <b>${topic.title}</b>! Let's go 👇\n\n<b>Step 1 of 4 — Pros</b>\nWhat did you like about it?`, { parse_mode: 'HTML' })
  db.prepare("UPDATE conversation_state SET step = 'awaiting_pros', updated_at = ? WHERE id = 1")
    .run(new Date().toISOString())
}

export async function handleIdea(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string,
  text: string
): Promise<void> {
  // Format: /idea Title | Category | URL  (Category and URL optional)
  const body = text.replace(/^\/idea\s*/i, '').trim()
  if (!body) {
    await sendMessage(chatId, '💡 Usage: <code>/idea Title | Category | URL</code>\nCategory and URL are optional.', { parse_mode: 'HTML' })
    return
  }
  const [title, category, url] = body.split('|').map(s => s.trim())
  if (!title) {
    await sendMessage(chatId, '💡 Usage: <code>/idea Title | Category | URL</code>', { parse_mode: 'HTML' })
    return
  }
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO topics (title, category, url, status, skip_count, created_at)
    VALUES (?, ?, ?, 'pending', 0, ?)
  `).run(title, category || null, url || null, now)
  const parts = [`✅ Idea saved: <b>${title}</b>`]
  if (category) parts.push(`🏷 ${category}`)
  if (url) parts.push(`🔗 ${url}`)
  await sendMessage(chatId, parts.join('\n'), { parse_mode: 'HTML' })
}

export async function handleHistory(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const reviews = db.prepare(`
    SELECT r.rating, t.title
    FROM reviews r
    JOIN topics t ON t.id = r.topic_id
    ORDER BY r.reviewed_at DESC
    LIMIT 5
  `).all() as { rating: number; title: string }[]

  if (reviews.length === 0) {
    await sendMessage(chatId, 'No reviews yet. Complete a topic first!')
    return
  }

  const lines = ['📋 <b>Your last reviews:</b>', '']
  for (const r of reviews) {
    lines.push(`• <b>${r.title}</b> — ${r.rating}/10`)
  }
  await sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' })
}
