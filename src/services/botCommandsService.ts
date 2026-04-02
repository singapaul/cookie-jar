import type Database from 'better-sqlite3'
import type { Topic, ConversationState, SendMessage, InlineKeyboardButton } from '../types.js'

type IdeaState = ConversationState & { idea_step: string; idea_draft_title: string | null; idea_draft_category: string | null }

const CATEGORY_KEYBOARD: InlineKeyboardButton[][] = [
  ['Frontend', 'Backend', 'JS runtime', 'AI tooling'].map(c => ({ text: c, callback_data: `idea_cat:${c}` })),
  ['AI model', 'Database', 'Testing', 'UI'].map(c => ({ text: c, callback_data: `idea_cat:${c}` })),
  ['State management', 'Auth', 'CSS', 'Build tool'].map(c => ({ text: c, callback_data: `idea_cat:${c}` })),
  [{ text: 'System design', callback_data: 'idea_cat:System design' }, { text: 'Other', callback_data: 'idea_cat:Other' }, { text: '⏭ Skip', callback_data: 'idea_cat_skip' }],
]

async function saveIdea(db: Database.Database, sendMessage: SendMessage, chatId: string, url: string | null): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as IdeaState
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES (?, ?, ?, 'pending', 0, ?)`)
    .run(state.idea_draft_title, state.idea_draft_category ?? null, url, now)
  db.prepare("UPDATE conversation_state SET idea_step = 'idle', idea_draft_title = NULL, idea_draft_category = NULL WHERE id = 1").run()
  const parts = [`✅ <b>Idea saved!</b> ${state.idea_draft_title}`]
  if (state.idea_draft_category) parts.push(`🏷 ${state.idea_draft_category}`)
  if (url) parts.push(`🔗 ${url}`)
  await sendMessage(chatId, parts.join('\n'), { parse_mode: 'HTML' })
}

export async function handleHelp(
  _db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  await sendMessage(
    chatId,
    `🍪 <b>Cookie Jar Bot</b>\n\n/help — Show this message\n/topic — See this week's topic\n/review — Start reviewing this week's topic\n/skip — Skip the current topic\n/status — Check the current step\n/history — See your last 5 reviews\n/topics — List all topics not yet covered\n/idea — Submit a new idea step by step`,
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
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as IdeaState

  // Handle URL step — plain text message when in awaiting_url
  if (state.idea_step === 'awaiting_url') {
    await saveIdea(db, sendMessage, chatId, text.trim())
    return
  }

  // Handle title step
  if (state.idea_step === 'awaiting_title') {
    const title = text.trim()
    if (!title) {
      await sendMessage(chatId, 'Please enter a title for your idea.')
      return
    }
    db.prepare("UPDATE conversation_state SET idea_draft_title = ?, idea_step = 'awaiting_category' WHERE id = 1").run(title)
    await sendMessage(chatId, `💡 <b>${title}</b>\n\nChoose a category:`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: CATEGORY_KEYBOARD } })
    return
  }

  // /idea command — check for inline title after the command
  const inline = text.replace(/^\/idea\s*/i, '').trim()
  if (inline) {
    // Shortcut: treat the rest as the title and go to category step
    db.prepare("UPDATE conversation_state SET idea_draft_title = ?, idea_step = 'awaiting_category', idea_draft_category = NULL WHERE id = 1").run(inline)
    await sendMessage(chatId, `💡 <b>${inline}</b>\n\nChoose a category:`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: CATEGORY_KEYBOARD } })
  } else {
    // No inline title — ask for one
    db.prepare("UPDATE conversation_state SET idea_step = 'awaiting_title', idea_draft_title = NULL, idea_draft_category = NULL WHERE id = 1").run()
    await sendMessage(chatId, `💡 <b>New idea</b>\n\nWhat's the title?`, { parse_mode: 'HTML' })
  }
}

export async function handleIdeaCallback(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string,
  data: string
): Promise<void> {
  const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as IdeaState

  if (data.startsWith('idea_cat:') || data === 'idea_cat_skip') {
    if (state.idea_step !== 'awaiting_category') return
    const category = data === 'idea_cat_skip' ? null : data.replace('idea_cat:', '')
    db.prepare("UPDATE conversation_state SET idea_draft_category = ?, idea_step = 'awaiting_url' WHERE id = 1").run(category)
    const catText = category ? `🏷 Category: <b>${category}</b>` : ''
    await sendMessage(
      chatId,
      `${catText}\n\nWhat's the URL? (paste it or tap Skip)`.trimStart(),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⏭ Skip URL', callback_data: 'idea_url_skip' }]] } }
    )
    return
  }

  if (data === 'idea_url_skip') {
    if (state.idea_step !== 'awaiting_url') return
    await saveIdea(db, sendMessage, chatId, null)
  }
}

export async function handleTopics(
  db: Database.Database,
  sendMessage: SendMessage,
  chatId: string
): Promise<void> {
  const topics = db.prepare(`
    SELECT title
    FROM topics
    WHERE status IN ('pending', 'skipped', 'sent')
    ORDER BY title
  `).all() as { title: string }[]

  if (topics.length === 0) {
    await sendMessage(chatId, '🎉 You\'ve covered everything in the jar!')
    return
  }

  const lines = [`📋 <b>Not yet covered (${topics.length}):</b>`, '']
  for (const t of topics) lines.push(`• ${t.title}`)

  await sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' })
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
