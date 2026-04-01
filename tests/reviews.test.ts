import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import type Database from 'better-sqlite3'
import type { Express } from 'express'
import { createApp } from '../src/app.js'
import { createDb } from '../src/db.js'

const API_KEY = 'test-key'
const auth = { Authorization: `Bearer ${API_KEY}` }

let app: Express
let db: Database.Database

function seedReview(db: Database.Database, overrides: {
  title?: string; category?: string; rating?: number
} = {}): number {
  const { title = 'Learn Rust', category = 'Systems', rating = 8 } = overrides
  db.prepare(
    "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES (?, ?, 'https://rust-lang.org', 'reviewed', 0, datetime('now'))"
  ).run(title, category)
  const topic = db.prepare('SELECT id FROM topics WHERE title = ?').get(title) as { id: number }
  db.prepare(
    'INSERT INTO reviews (topic_id, pros, cons, rating, verdict, reviewed_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(topic.id, 'Great', 'Hard', rating, 'Worth it')
  const review = db.prepare('SELECT id FROM reviews WHERE topic_id = ?').get(topic.id) as { id: number }
  return review.id
}

beforeEach(() => {
  db = createDb(':memory:')
  app = createApp(db, API_KEY)
})

describe('GET /reviews', () => {
  it('returns all reviews joined with topic fields', async () => {
    seedReview(db)

    const res = await request(app).get('/reviews').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].pros).toBe('Great')
    expect(res.body[0].rating).toBe(8)
    expect(res.body[0].title).toBe('Learn Rust')
    expect(res.body[0].category).toBe('Systems')
    expect(res.body[0].url).toBe('https://rust-lang.org')
  })

  it('filters by topic category', async () => {
    seedReview(db, { title: 'Learn Rust', category: 'Systems' })
    seedReview(db, { title: 'Learn K8s', category: 'DevOps' })

    const res = await request(app).get('/reviews?category=Systems').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].category).toBe('Systems')
  })

  it('filters by min_rating', async () => {
    seedReview(db, { title: 'Topic A', rating: 5 })
    seedReview(db, { title: 'Topic B', rating: 9 })

    const res = await request(app).get('/reviews?min_rating=7').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].rating).toBe(9)
  })
})

describe('GET /reviews/:id', () => {
  it('returns single review with topic details', async () => {
    const id = seedReview(db)

    const res = await request(app).get(`/reviews/${id}`).set(auth)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(id)
    expect(res.body.verdict).toBe('Worth it')
    expect(res.body.title).toBe('Learn Rust')
    expect(res.body.url).toBe('https://rust-lang.org')
  })

  it('returns 404 when review does not exist', async () => {
    const res = await request(app).get('/reviews/999').set(auth)
    expect(res.status).toBe(404)
  })
})
