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

describe('POST /telegram/webhook — /idea command', () => {
  it('starts idea flow and prompts for category when title provided inline', async () => {
    await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/idea Learn Rust' } })

    const state = db.prepare('SELECT idea_step, idea_draft_title FROM conversation_state WHERE id = 1').get() as { idea_step: string; idea_draft_title: string }
    expect(state.idea_step).toBe('awaiting_category')
    expect(state.idea_draft_title).toBe('Learn Rust')
    // No topic saved yet
    const count = (db.prepare('SELECT COUNT(*) as n FROM topics').get() as { n: number }).n
    expect(count).toBe(0)
  })

  it('starts idea flow and prompts for category when title and extra info provided inline', async () => {
    await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/idea Learn Rust | Systems | https://rust-lang.org' } })

    const state = db.prepare('SELECT idea_step, idea_draft_title FROM conversation_state WHERE id = 1').get() as { idea_step: string; idea_draft_title: string }
    expect(state.idea_step).toBe('awaiting_category')
    expect(state.idea_draft_title).toBe('Learn Rust | Systems | https://rust-lang.org')
  })

  it('prompts for title when /idea sent with no inline text', async () => {
    await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: '/idea' } })

    const state = db.prepare('SELECT idea_step FROM conversation_state WHERE id = 1').get() as { idea_step: string }
    expect(state.idea_step).toBe('awaiting_title')
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("title"), expect.any(Object))
    const count = (db.prepare('SELECT COUNT(*) as n FROM topics').get() as { n: number }).n
    expect(count).toBe(0)
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

describe('POST /telegram/webhook — /idea step-by-step flow', () => {
  it('starts the idea flow when /idea is sent with no title', async () => {
    await request(app).post('/telegram/webhook').send({ message: { text: '/idea' } })
    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { idea_step: string }
    expect(state.idea_step).toBe('awaiting_title')
    expect(mockSend).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('title'), expect.any(Object))
  })

  it('shows category keyboard when title is provided inline', async () => {
    await request(app).post('/telegram/webhook').send({ message: { text: '/idea Learn Rust' } })
    const state = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { idea_step: string; idea_draft_title: string }
    expect(state.idea_step).toBe('awaiting_category')
    expect(state.idea_draft_title).toBe('Learn Rust')
  })

  it('saves the idea after full flow: title → category callback → url skip', async () => {
    // Set up: already in awaiting_category with a title
    db.prepare("UPDATE conversation_state SET idea_step = 'awaiting_category', idea_draft_title = 'Learn Rust' WHERE id = 1").run()

    await request(app).post('/telegram/webhook').send({ callback_query: { id: 'x', data: 'idea_cat:Systems' } })

    const stateAfterCat = db.prepare('SELECT idea_step FROM conversation_state WHERE id = 1').get() as { idea_step: string }
    expect(stateAfterCat.idea_step).toBe('awaiting_url')

    await request(app).post('/telegram/webhook').send({ callback_query: { id: 'y', data: 'idea_url_skip' } })

    const topic = db.prepare("SELECT * FROM topics WHERE title = 'Learn Rust'").get() as { category: string; status: string } | undefined
    expect(topic).toBeDefined()
    expect(topic!.status).toBe('pending')
  })
})
