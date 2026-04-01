import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('auth middleware', () => {
  const app = createApp(null, 'secret-key')

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    const res = await request(app).get('/health').set('Authorization', 'Bearer wrong-token')
    expect(res.status).toBe(401)
  })

  it('passes through when correct Bearer token is provided', async () => {
    const res = await request(app).get('/health').set('Authorization', 'Bearer secret-key')
    expect(res.status).toBe(200)
  })
})
