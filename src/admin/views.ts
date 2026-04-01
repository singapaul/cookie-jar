import type { Topic, Review } from '../types.js'

const picoCSS = 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css'

const layout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Cookie Jar</title>
  <link rel="stylesheet" href="${picoCSS}">
</head>
<body>
  <main class="container">
    ${body}
  </main>
</body>
</html>`

export function adminLayout(title: string, activePage: 'ideas' | 'reviews', body: string): string {
  return layout(title, `
    <nav>
      <ul><li><strong>Cookie Jar</strong></li></ul>
      <ul>
        <li><a href="/admin" ${activePage === 'ideas' ? 'aria-current="page"' : ''}>Ideas</a></li>
        <li><a href="/admin/reviews" ${activePage === 'reviews' ? 'aria-current="page"' : ''}>Reviews</a></li>
      </ul>
    </nav>
    ${body}
  `)
}

export function loginPage(error?: string): string {
  return layout('Login', `
    <article>
      <h2>Cookie Jar Admin</h2>
      ${error ? `<p style="color:red">${error}</p>` : ''}
      <form method="POST" action="/admin/login">
        <label>
          Password
          <input type="password" name="password" autofocus required>
        </label>
        <button type="submit">Log in</button>
      </form>
    </article>
  `)
}

function topicCard(t: Topic): string {
  const editForm = t.status === 'pending' ? `
    <form method="POST" action="/admin/ideas/${t.id}/edit" style="margin-top:0.5rem">
      <input name="title" value="${t.title}" required>
      <input name="category" value="${t.category ?? ''}">
      <input name="description" value="${t.description ?? ''}">
      <input name="url" value="${t.url ?? ''}">
      <button type="submit" class="outline">Save</button>
    </form>` : ''

  return `
    <article>
      <header>
        <strong>${t.title}</strong>
        <small> — ${t.status}${t.skip_count > 0 ? ` (skipped ${t.skip_count}x)` : ''}</small>
      </header>
      ${t.category ? `<p>Category: ${t.category}</p>` : ''}
      ${t.url ? `<p><a href="${t.url}" target="_blank">${t.url}</a></p>` : ''}
      ${editForm}
      <footer>
        <form method="POST" action="/admin/ideas/${t.id}/skip" style="display:inline">
          <button type="submit" class="outline">Skip</button>
        </form>
        <form method="POST" action="/admin/ideas/${t.id}/delete" style="display:inline">
          <button type="submit" class="outline contrast">Delete</button>
        </form>
      </footer>
    </article>`
}

export function ideasPage(topics: Topic[], flash?: string): string {
  const active = topics.filter(t => t.status === 'pending' || t.status === 'skipped')
  const archived = topics.filter(t => t.status === 'archived')

  const activeRows = active.length === 0
    ? '<p>No ideas yet — add one below!</p>'
    : active.map(topicCard).join('')

  const archivedRows = archived.length === 0
    ? '<p>No archived topics.</p>'
    : archived.map(t => `
        <article>
          <strong>${t.title}</strong>
          <small> — archived (skipped ${t.skip_count}x)</small>
        </article>`).join('')

  return adminLayout('Ideas', 'ideas', `
    ${flash ? `<div role="alert">${flash}</div>` : ''}
    <h2>Add Idea</h2>
    <form method="POST" action="/admin/ideas">
      <input name="title" placeholder="Title" required>
      <input name="category" placeholder="Category">
      <input name="description" placeholder="Description">
      <input name="url" placeholder="URL">
      <button type="submit">Add</button>
    </form>
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <form method="POST" action="/admin/send-weekly">
        <button type="submit">Send this week's topic</button>
      </form>
      <form method="POST" action="/admin/send-review-prompt">
        <button type="submit" class="outline">Send review prompt</button>
      </form>
    </div>
    <h2>Ideas</h2>
    ${activeRows}
    <details>
      <summary>Archived</summary>
      ${archivedRows}
    </details>
  `)
}

export function reviewsPage(reviews: (Review & { title: string; category: string | null; url: string | null })[]): string {
  const cards = reviews.length === 0
    ? '<p>No reviews yet.</p>'
    : reviews.map(r => `
        <article>
          <header>
            <strong>${r.title}</strong>
            ${r.category ? `<small> — ${r.category}</small>` : ''}
            <span style="float:right;font-size:2rem">${r.rating}/10</span>
          </header>
          ${r.url ? `<p><a href="${r.url}" target="_blank">${r.url}</a></p>` : ''}
          <p><strong>Pros:</strong> ${r.pros ?? '—'}</p>
          <p><strong>Cons:</strong> ${r.cons ?? '—'}</p>
          <p><strong>Verdict:</strong> ${r.verdict ?? '—'}</p>
          <footer><small>Reviewed: ${r.reviewed_at}</small></footer>
        </article>`).join('')

  return adminLayout('Reviews', 'reviews', `
    <h2>Review History</h2>
    ${cards}
  `)
}
