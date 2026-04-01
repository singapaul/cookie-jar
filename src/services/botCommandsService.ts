import type Database from 'better-sqlite3'
import type { Topic, ConversationState, SendMessage } from '../types.js'

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
