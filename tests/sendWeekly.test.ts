import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from '../src/db.js'
import { sendWeekly } from '../src/services/schedulerService.js'
import type { SendMessage } from '../src/types.js'

const CHAT_ID = '12345'

let db: Database.Database
let sendMessage: SendMessage

beforeEach(() => {
  db = createDb(':memory:')
  sendMessage = vi.fn().mockResolvedValue({})
})

describe('sendWeekly', () => {
  it('sends a warning and aborts when conversation step is not idle', async () => {
    db.prepare("UPDATE conversation_state SET step = 'awaiting_pros' WHERE id = 1").run()

    const result = await sendWeekly(db, sendMessage, CHAT_ID)

    expect(result.aborted).toBe(true)
    expect(sendMessage).toHaveBeenCalledOnce()
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/already in progress/i)
  })

  it('sends a warning and aborts when no eligible topics exist', async () => {
    const result = await sendWeekly(db, sendMessage, CHAT_ID)

    expect(result.aborted).toBe(true)
    expect(sendMessage).toHaveBeenCalledOnce()
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/no topics/i)
  })

  it('marks topic as sent, updates conversation_state, sends formatted message', async () => {
    db.prepare(
      "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn Rust', 'Systems', 'https://rust-lang.org', 'pending', 0, datetime('now'))"
    ).run()

    const result = await sendWeekly(db, sendMessage, CHAT_ID)

    expect(result.aborted).toBe(false)
    if (!result.aborted) {
      expect(result.topic.title).toBe('Learn Rust')
      expect(result.topic.status).toBe('sent')
      expect(result.topic.sent_at).toBeDefined()

      const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { topic_id: number }
      expect(state.topic_id).toBe(result.topic.id)
    }

    expect(sendMessage).toHaveBeenCalledOnce()
    const msg = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(msg).toMatch(/Learn Rust/)
    expect(msg).toMatch(/Systems/)
    expect(msg).toMatch(/https:\/\/rust-lang\.org/)
    expect(msg).toMatch(/Sunday/i)
  })

  it('includes skipped topics with skip_count < 3 as eligible', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Skipped Topic', 'skipped', 2, datetime('now'))"
    ).run()

    const result = await sendWeekly(db, sendMessage, CHAT_ID)

    expect(result.aborted).toBe(false)
    if (!result.aborted) {
      expect(result.topic.title).toBe('Skipped Topic')
    }
  })

  it('excludes skipped topics with skip_count >= 3', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Exhausted Topic', 'skipped', 3, datetime('now'))"
    ).run()

    const result = await sendWeekly(db, sendMessage, CHAT_ID)

    expect(result.aborted).toBe(true)
  })
})
