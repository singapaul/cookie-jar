import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from '../src/db.js'
import { handleStatus, handleSkip } from '../src/services/botCommandsService.js'
import type { SendMessage } from '../src/types.js'

const CHAT_ID = '12345'

let db: Database.Database
let sendMessage: SendMessage

beforeEach(() => {
  db = createDb(':memory:')
  sendMessage = vi.fn().mockResolvedValue({})
})

describe('/status command', () => {
  it('replies with idle message when no active topic', async () => {
    await handleStatus(db, sendMessage, CHAT_ID)
    expect(sendMessage).toHaveBeenCalledOnce()
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/no active topic/i)
  })

  it('replies with current topic title and step when active', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'sent', 0, datetime('now'))"
    ).run()
    const topic = db.prepare("SELECT * FROM topics WHERE title = 'Learn Rust'").get() as { id: number }
    db.prepare("UPDATE conversation_state SET topic_id = ?, step = 'awaiting_pros' WHERE id = 1")
      .run(topic.id)

    await handleStatus(db, sendMessage, CHAT_ID)

    const msg = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(msg).toMatch(/Learn Rust/)
    expect(msg).toMatch(/awaiting_pros/)
  })
})

describe('/skip command', () => {
  it('increments skip_count on current topic and resets state to idle', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'sent', 0, datetime('now'))"
    ).run()
    const topic = db.prepare("SELECT * FROM topics WHERE title = 'Learn Rust'").get() as { id: number }
    db.prepare("UPDATE conversation_state SET topic_id = ?, step = 'idle' WHERE id = 1")
      .run(topic.id)

    await handleSkip(db, sendMessage, CHAT_ID)

    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as { skip_count: number; status: string }
    expect(updated.skip_count).toBe(1)
    expect(updated.status).toBe('skipped')

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; topic_id: number | null }
    expect(state.step).toBe('idle')
    expect(state.topic_id).toBeNull()

    expect(sendMessage).toHaveBeenCalledOnce()
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/skipped/i)
  })

  it('replies with no active topic message when state is idle with no topic', async () => {
    await handleSkip(db, sendMessage, CHAT_ID)
    expect((sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatch(/no active topic/i)
  })
})
