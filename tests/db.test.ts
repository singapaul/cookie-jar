import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from '../src/db.js'

describe('createDb', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('creates the topics table with the correct columns', () => {
    const cols = (db.prepare('PRAGMA table_info(topics)').all() as { name: string }[]).map(c => c.name)
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'title', 'description', 'category', 'url',
      'status', 'skip_count', 'created_at', 'sent_at',
    ]))
  })

  it('creates the reviews table with the correct columns', () => {
    const cols = (db.prepare('PRAGMA table_info(reviews)').all() as { name: string }[]).map(c => c.name)
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'topic_id', 'pros', 'cons', 'rating', 'verdict', 'reviewed_at',
    ]))
  })

  it('creates the conversation_state table with the correct columns', () => {
    const cols = (db.prepare('PRAGMA table_info(conversation_state)').all() as { name: string }[]).map(c => c.name)
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'topic_id', 'step', 'draft_pros', 'draft_cons', 'updated_at',
    ]))
  })

  it('seeds conversation_state row with id=1 and step=idle', () => {
    const row = db.prepare('SELECT * FROM conversation_state WHERE id = 1').get() as { step: string; topic_id: number | null }
    expect(row).toBeDefined()
    expect(row.step).toBe('idle')
    expect(row.topic_id).toBeNull()
  })

  it('does not duplicate conversation_state seed on repeated calls', () => {
    createDb(':memory:')
    const rows = db.prepare('SELECT COUNT(*) as count FROM conversation_state').get() as { count: number }
    expect(rows.count).toBe(1)
  })
})
