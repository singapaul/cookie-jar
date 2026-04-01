import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from '../src/db.js'
import { handleMessage } from '../src/services/reviewService.js'
import type { SendMessage } from '../src/types.js'

const CHAT_ID = '12345'

let db: Database.Database
let sendMessage: SendMessage

function seedSentTopic(db: Database.Database): number {
  db.prepare(
    "INSERT INTO topics (title, category, status, skip_count, created_at) VALUES ('Learn Rust', 'Systems', 'sent', 0, datetime('now'))"
  ).run()
  const topic = db.prepare("SELECT id FROM topics WHERE title = 'Learn Rust'").get() as { id: number }
  db.prepare("UPDATE conversation_state SET topic_id = ?, step = 'awaiting_pros' WHERE id = 1")
    .run(topic.id)
  return topic.id
}

beforeEach(() => {
  db = createDb(':memory:')
  sendMessage = vi.fn().mockResolvedValue({})
})

describe('review state machine', () => {
  it('awaiting_pros: stores pros, advances to awaiting_cons', async () => {
    seedSentTopic(db)

    await handleMessage(db, sendMessage, CHAT_ID, 'It was great for learning')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; draft_pros: string }
    expect(state.step).toBe('awaiting_cons')
    expect(state.draft_pros).toBe('It was great for learning')
    expect(sendMessage).toHaveBeenCalledOnce()
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/cons/i)
  })

  it('awaiting_cons: stores cons, advances to awaiting_rating', async () => {
    seedSentTopic(db)
    db.prepare("UPDATE conversation_state SET step = 'awaiting_cons', draft_pros = 'Good stuff' WHERE id = 1").run()

    await handleMessage(db, sendMessage, CHAT_ID, 'Steep learning curve')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; draft_cons: string }
    expect(state.step).toBe('awaiting_rating')
    expect(state.draft_cons).toBe('Steep learning curve')
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/rat/i)
  })

  it('awaiting_rating: valid integer 1-10 advances to awaiting_verdict', async () => {
    seedSentTopic(db)
    db.prepare("UPDATE conversation_state SET step = 'awaiting_rating', draft_pros = 'p', draft_cons = 'c' WHERE id = 1").run()

    await handleMessage(db, sendMessage, CHAT_ID, '8')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; draft_rating: number }
    expect(state.step).toBe('awaiting_verdict')
    expect(state.draft_rating).toBe(8)
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/verdict/i)
  })

  it('awaiting_rating: non-integer re-prompts and stays on awaiting_rating', async () => {
    seedSentTopic(db)
    db.prepare("UPDATE conversation_state SET step = 'awaiting_rating', draft_pros = 'p', draft_cons = 'c' WHERE id = 1").run()

    await handleMessage(db, sendMessage, CHAT_ID, 'great')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string }
    expect(state.step).toBe('awaiting_rating')
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/1.{1,5}10/i)
  })

  it('awaiting_rating: out-of-range integer re-prompts and stays on awaiting_rating', async () => {
    seedSentTopic(db)
    db.prepare("UPDATE conversation_state SET step = 'awaiting_rating', draft_pros = 'p', draft_cons = 'c' WHERE id = 1").run()

    await handleMessage(db, sendMessage, CHAT_ID, '11')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string }
    expect(state.step).toBe('awaiting_rating')
  })

  it('awaiting_verdict: saves review, sets topic reviewed, resets state, sends confirmation', async () => {
    const topicId = seedSentTopic(db)
    db.prepare(
      "UPDATE conversation_state SET step = 'awaiting_verdict', draft_pros = 'Great', draft_cons = 'Hard', draft_rating = 8 WHERE id = 1"
    ).run()

    await handleMessage(db, sendMessage, CHAT_ID, 'Would definitely revisit')

    const review = db.prepare('SELECT * FROM reviews WHERE topic_id = ?').get(topicId) as {
      pros: string; cons: string; rating: number; verdict: string; reviewed_at: string
    }
    expect(review).toBeDefined()
    expect(review.pros).toBe('Great')
    expect(review.cons).toBe('Hard')
    expect(review.rating).toBe(8)
    expect(review.verdict).toBe('Would definitely revisit')
    expect(review.reviewed_at).toBeDefined()

    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as { status: string }
    expect(topic.status).toBe('reviewed')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; topic_id: number | null }
    expect(state.step).toBe('idle')
    expect(state.topic_id).toBeNull()

    const msg = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(msg).toMatch(/review saved/i)
    expect(msg).toMatch(/Great/)
    expect(msg).toMatch(/Hard/)
    expect(msg).toMatch(/8/)
    expect(msg).toMatch(/Would definitely revisit/)
  })

  it('ignores messages when state is idle', async () => {
    await handleMessage(db, sendMessage, CHAT_ID, 'hello')
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
