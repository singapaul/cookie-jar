import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/db.js'
import type { Express } from 'express'
import type Database from 'better-sqlite3'

let app: Express
let db: Database.Database
const mockSend = vi.fn().mockResolvedValue({})

beforeEach(() => {
  vi.clearAllMocks()
  db = createDb(':memory:')
  app = createApp(db, 'test-key', mockSend)
})

describe('POST /telegram/webhook — commands', () => {
  it('responds 200 to /help command', async () => {
    const res = await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/help' } })
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('/help'), expect.objectContaining({ parse_mode: 'HTML' }))
  })

  it('responds 200 to /topic when no active topic', async () => {
    const res = await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/topic' } })
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('No active topic'))
  })

  it('responds 200 to /history when no reviews', async () => {
    const res = await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/history' } })
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('No reviews yet'))
  })

  it('responds 200 to /review when no active topic', async () => {
    const res = await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/review' } })
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('No active topic'))
  })
})

describe('POST /telegram/webhook — callback_query', () => {
  it('responds 200 to callback_query events', async () => {
    const res = await request(app)
      .post('/telegram/webhook')
      .send({ callback_query: { id: 'abc', data: 'rating:7' } })
    expect(res.status).toBe(200)
  })

  it('processes rating:N callback when in awaiting_rating step', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Test', 'sent', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare("UPDATE conversation_state SET topic_id = ?, step = 'awaiting_rating', updated_at = datetime('now') WHERE id = 1").run(topic.id)

    await request(app)
      .post('/telegram/webhook')
      .send({ callback_query: { id: 'abc', data: 'rating:8' } })

    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; draft_rating: number }
    expect(state.step).toBe('awaiting_verdict')
    expect(state.draft_rating).toBe(8)
  })
})
