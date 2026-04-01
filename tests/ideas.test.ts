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

beforeEach(() => {
  db = createDb(':memory:')
  app = createApp(db, API_KEY)
})

describe('POST /ideas', () => {
  it('creates a topic with defaults and returns it', async () => {
    const res = await request(app)
      .post('/ideas')
      .set(auth)
      .send({ title: 'Learn Rust', category: 'DevOps' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Learn Rust')
    expect(res.body.category).toBe('DevOps')
    expect(res.body.status).toBe('pending')
    expect(res.body.skip_count).toBe(0)
    expect(res.body.id).toBeDefined()
  })
})

describe('GET /ideas', () => {
  beforeEach(async () => {
    await request(app).post('/ideas').set(auth).send({ title: 'Topic A', category: 'AI' })
    await request(app).post('/ideas').set(auth).send({ title: 'Topic B', category: 'DevOps' })
  })

  it('returns all topics', async () => {
    const res = await request(app).get('/ideas').set(auth)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('filters by category', async () => {
    const res = await request(app).get('/ideas?category=AI').set(auth)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].category).toBe('AI')
  })

  it('filters by status', async () => {
    const res = await request(app).get('/ideas?status=pending').set(auth)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)

    const res2 = await request(app).get('/ideas?status=sent').set(auth)
    expect(res2.body).toHaveLength(0)
  })
})

describe('PATCH /ideas/:id', () => {
  it('edits title/description/category/url when status=pending', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'Old Title' })
    const id = created.body.id as number

    const res = await request(app)
      .patch(`/ideas/${id}`)
      .set(auth)
      .send({ title: 'New Title', description: 'desc', category: 'AI', url: 'https://x.com' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('New Title')
    expect(res.body.description).toBe('desc')
    expect(res.body.category).toBe('AI')
    expect(res.body.url).toBe('https://x.com')
  })

  it('returns 403 when topic is not pending', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'Topic' })
    const id = created.body.id as number
    db.prepare("UPDATE topics SET status = 'sent' WHERE id = ?").run(id)

    const res = await request(app).patch(`/ideas/${id}`).set(auth).send({ title: 'New' })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /ideas/:id', () => {
  it('deletes topic when status=pending', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'To Delete' })
    const id = created.body.id as number

    const res = await request(app).delete(`/ideas/${id}`).set(auth)
    expect(res.status).toBe(204)

    const list = await request(app).get('/ideas').set(auth)
    expect(list.body).toHaveLength(0)
  })

  it('returns 403 when topic is not pending', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'Topic' })
    const id = created.body.id as number
    db.prepare("UPDATE topics SET status = 'sent' WHERE id = ?").run(id)

    const res = await request(app).delete(`/ideas/${id}`).set(auth)
    expect(res.status).toBe(403)
  })
})

describe('POST /ideas/:id/skip', () => {
  it('increments skip_count', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'Topic' })
    const id = created.body.id as number
    db.prepare("UPDATE topics SET status = 'skipped' WHERE id = ?").run(id)

    const res = await request(app).post(`/ideas/${id}/skip`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.skip_count).toBe(1)
    expect(res.body.status).toBe('skipped')
  })

  it('auto-archives when skip_count reaches 3', async () => {
    const created = await request(app).post('/ideas').set(auth).send({ title: 'Topic' })
    const id = created.body.id as number
    db.prepare("UPDATE topics SET status = 'skipped', skip_count = 2 WHERE id = ?").run(id)

    const res = await request(app).post(`/ideas/${id}/skip`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.skip_count).toBe(3)
    expect(res.body.status).toBe('archived')
  })
})
