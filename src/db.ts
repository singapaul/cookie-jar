import Database from 'better-sqlite3'

export function createDb(path: string): Database.Database {
  const db = new Database(path)

  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      category    TEXT,
      url         TEXT,
      status      TEXT DEFAULT 'pending',
      skip_count  INTEGER DEFAULT 0,
      created_at  DATETIME,
      sent_at     DATETIME
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY,
      topic_id    INTEGER,
      pros        TEXT,
      cons        TEXT,
      rating      INTEGER,
      verdict     TEXT,
      reviewed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS conversation_state (
      id          INTEGER PRIMARY KEY,
      topic_id    INTEGER,
      step         TEXT DEFAULT 'idle',
      draft_pros   TEXT,
      draft_cons   TEXT,
      draft_rating INTEGER,
      updated_at   DATETIME
    );
  `)

  const existing = db.prepare('SELECT id FROM conversation_state WHERE id = 1').get()
  if (!existing) {
    db.prepare(
      "INSERT INTO conversation_state (id, step, topic_id) VALUES (1, 'idle', NULL)"
    ).run()
  }

  return db
}
