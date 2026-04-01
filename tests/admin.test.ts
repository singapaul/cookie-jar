import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/db.js'
import type { Express } from 'express'
import type Database from 'better-sqlite3'

const API_KEY = 'test-key'

let app: Express
let db: Database.Database

async function getSessionCookie(): Promise<string> {
  const res = await request(app)
    .post('/admin/login')
    .send('password=test-key')
    .set('Content-Type', 'application/x-www-form-urlencoded')
  const cookies = res.headers['set-cookie'] as unknown as string[]
  return cookies[0]
}

beforeEach(() => {
  db = createDb(':memory:')
  app = createApp(db, API_KEY, vi.fn().mockResolvedValue({}))
})

describe('GET /admin/login', () => {
  it('renders the login form without requiring auth', async () => {
    const res = await request(app).get('/admin/login')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/login/i)
    expect(res.text).toMatch(/password/i)
  })
})

describe('POST /admin/login', () => {
  it('redirects to /admin and sets cookie on correct password', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send('password=test-key')
      .set('Content-Type', 'application/x-www-form-urlencoded')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('re-renders login with error on wrong password', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send('password=wrong')
      .set('Content-Type', 'application/x-www-form-urlencoded')

    expect(res.status).toBe(200)
    expect(res.text).toMatch(/invalid/i)
    expect(res.headers['set-cookie']).toBeUndefined()
  })
})

describe('admin session middleware', () => {
  it('redirects unauthenticated requests to /admin/login', async () => {
    const res = await request(app).get('/admin')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin/login')
  })

  it('passes through requests with a valid session cookie', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.status).not.toBe(302)
  })

  it('does not apply Bearer auth to /admin routes', async () => {
    const res = await request(app).get('/admin/login')
    expect(res.status).not.toBe(401)
  })
})

describe('GET /admin (ideas page)', () => {
  it('shows empty state when no topics exist', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/no ideas/i)
  })

  it('renders pending and skipped topics with their details', async () => {
    db.prepare(
      "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn Rust', 'Systems', 'https://rust-lang.org', 'pending', 0, datetime('now'))"
    ).run()
    db.prepare(
      "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn K8s', 'DevOps', NULL, 'skipped', 1, datetime('now'))"
    ).run()

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)

    expect(res.text).toMatch(/Learn Rust/)
    expect(res.text).toMatch(/Systems/)
    expect(res.text).toMatch(/https:\/\/rust-lang\.org/)
    expect(res.text).toMatch(/pending/)
    expect(res.text).toMatch(/Learn K8s/)
    expect(res.text).toMatch(/skipped/)
  })

  it('does not show sent or reviewed topics in the main list', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Sent Topic', 'sent', 0, datetime('now'))"
    ).run()

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(/Sent Topic/)
  })

  it('includes nav bar with Ideas and Reviews links', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/href="\/admin"/)
    expect(res.text).toMatch(/href="\/admin\/reviews"/)
  })
})

describe('POST /admin/ideas', () => {
  it('creates a topic and redirects to /admin', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .post('/admin/ideas')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('title=New+Idea&category=AI&description=desc&url=https://example.com')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')

    const topic = db.prepare("SELECT * FROM topics WHERE title = 'New Idea'").get() as { status: string; category: string }
    expect(topic).toBeDefined()
    expect(topic.status).toBe('pending')
    expect(topic.category).toBe('AI')
  })

  it('redirects back without creating when title is missing', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .post('/admin/ideas')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('category=AI')

    expect(res.status).toBe(302)
    const count = (db.prepare('SELECT COUNT(*) as n FROM topics').get() as { n: number }).n
    expect(count).toBe(0)
  })
})

describe('POST /admin/ideas/:id/edit', () => {
  it('updates topic fields and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, category, status, skip_count, created_at) VALUES ('Old Title', 'Systems', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/edit`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('title=New+Title&category=AI&description=desc&url=https://example.com')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as { title: string; category: string }
    expect(updated.title).toBe('New Title')
    expect(updated.category).toBe('AI')
  })
})

describe('POST /admin/ideas/:id/delete', () => {
  it('deletes the topic and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('To Delete', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/delete`)
      .set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const gone = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id)
    expect(gone).toBeUndefined()
  })
})

describe('POST /admin/ideas/:id/skip', () => {
  it('increments skip_count and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/skip`)
      .set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as { skip_count: number; status: string }
    expect(updated.skip_count).toBe(1)
    expect(updated.status).toBe('skipped')
  })
})

describe('POST /admin/send-weekly', () => {
  it('redirects to /admin with success flash when topic is sent', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-weekly').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/\/admin\?flash=/)
    expect(decodeURIComponent(res.headers.location)).toMatch(/sent/i)
  })

  it('redirects with error flash when no eligible topics', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-weekly').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/could not/i)
  })
})

describe('POST /admin/send-review-prompt', () => {
  it('redirects with success flash when review prompt sent', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'sent', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare('UPDATE conversation_state SET topic_id = ? WHERE id = 1').run(topic.id)
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-review-prompt').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/sent/i)
  })

  it('redirects with warning flash when no active topic', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-review-prompt').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/no active/i)
  })
})

describe('GET /admin — flash message', () => {
  it('renders flash message from query param', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .get('/admin?flash=Topic%20sent!')
      .set('Cookie', cookie)

    expect(res.text).toMatch(/Topic sent!/)
  })

  it('renders no flash div when no query param', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(/role="alert"/)
  })
})

describe('GET /admin — archived section', () => {
  it('shows archived topics in a details section', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Archived Topic', 'archived', 3, datetime('now'))").run()
    const cookie = await getSessionCookie()

    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/Archived Topic/)
    expect(res.text).toMatch(/<details/)
  })

  it('shows no archived topics message when none exist', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/no archived/i)
  })

  it('does not show edit button for skipped topics', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Skipped', 'skipped', 1, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(new RegExp(`/admin/ideas/${topic.id}/edit`))
  })
})
