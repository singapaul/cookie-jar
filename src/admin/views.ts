import type { Topic, Review } from '../types.js'

export const CATEGORIES = [
  'Frontend', 'Backend', 'JS runtime', 'AI tooling', 'AI model',
  'Database', 'Testing', 'UI', 'State management', 'Auth', 'CSS',
  'Build tool', 'Other',
]

const picoCSS = 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css'

const layout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Cookie Jar</title>
  <link rel="stylesheet" href="${picoCSS}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍪</text></svg>">
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

function statusBadge(status: string): string {
  const styles: Record<string, string> = {
    pending:  'background:#d1fae5;color:#065f46',
    skipped:  'background:#fed7aa;color:#9a3412',
    archived: 'background:#e5e7eb;color:#374151',
  }
  const style = styles[status] ?? 'background:#e5e7eb;color:#374151'
  return `<span style="${style};padding:0.2em 0.6em;border-radius:999px;font-size:0.75rem">${status}</span>`
}

function categorySelect(name: string, current?: string | null, includeAll = false): string {
  const allOption = includeAll ? '<option value="">All categories</option>' : ''
  const options = CATEGORIES.map(c =>
    `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`
  ).join('')
  return `<select name="${name}">${allOption}${options}</select>`
}

function topicCard(t: Topic): string {
  const editForm = t.status === 'pending' ? `
    <details style="margin-top:0.5rem">
      <summary>Edit</summary>
      <form method="POST" action="/admin/ideas/${t.id}/edit" style="margin-top:0.5rem">
        <input name="title" value="${t.title}" required>
        ${categorySelect('category', t.category)}
        <input name="description" value="${t.description ?? ''}">
        <input name="url" value="${t.url ?? ''}">
        <button type="submit" class="outline">Save</button>
      </form>
    </details>` : ''

  return `
    <article>
      <header style="display:flex;justify-content:space-between;align-items:center">
        <strong>${t.title}</strong>
        <div>${statusBadge(t.status)}${t.skip_count > 0 ? `<small> (skipped ${t.skip_count}x)</small>` : ''}</div>
      </header>
      ${t.category ? `<p>Category: ${t.category}</p>` : ''}
      ${t.url ? `<p><a href="${t.url}" target="_blank">${t.url}</a></p>` : ''}
      ${editForm}
      <footer>
        <form method="POST" action="/admin/ideas/${t.id}/skip" style="display:inline">
          <button type="submit" class="outline">Skip</button>
        </form>
        <form method="POST" action="/admin/ideas/${t.id}/delete" style="display:inline">
          <button type="submit" class="outline contrast" onclick="return confirm('Delete this topic?')">Delete</button>
        </form>
      </footer>
    </article>`
}

type StatsResult = {
  total: number
  pending: number
  skipped: number
  archived: number
  sent: number
  reviewed: number
  avgRating: number | null
}

function statsCards(stats: StatsResult): string {
  const avgText = stats.avgRating !== null ? ` (avg ${stats.avgRating})` : ''
  return `
    <div class="grid">
      <article>
        <header><strong>Total topics</strong></header>
        <p style="font-size:2rem;margin:0">${stats.total}</p>
      </article>
      <article>
        <header><strong>Reviews completed</strong></header>
        <p style="font-size:2rem;margin:0">${stats.reviewed}${avgText}</p>
      </article>
      <article>
        <header><strong>Pending / Skipped</strong></header>
        <p style="font-size:2rem;margin:0">${stats.pending} / ${stats.skipped}</p>
      </article>
    </div>`
}

export function ideasPage(
  topics: Topic[],
  flash?: string,
  stats?: StatsResult,
  search?: string,
  filterCategory?: string,
  page = 1,
  totalActive?: number,
  pageSize = 20,
): string {
  const active = topics.filter(t => t.status === 'pending' || t.status === 'skipped')
  const archived = topics.filter(t => t.status === 'archived')

  const totalPages = totalActive !== undefined ? Math.max(1, Math.ceil(totalActive / pageSize)) : 1

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

  const searchParams = `search=${encodeURIComponent(search ?? '')}&category=${encodeURIComponent(filterCategory ?? '')}`

  const paginationControls = totalActive !== undefined && totalPages > 1 ? `
    <div style="display:flex;gap:0.5rem;align-items:center;margin:1rem 0">
      ${page > 1 ? `<a href="/admin?page=${page - 1}&${searchParams}"><button class="outline">← Prev</button></a>` : ''}
      <span>Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/admin?page=${page + 1}&${searchParams}"><button class="outline">Next →</button></a>` : ''}
    </div>` : ''

  return adminLayout('Ideas', 'ideas', `
    ${flash ? `<div role="alert">${flash}</div>` : ''}
    ${stats ? statsCards(stats) : ''}
    <h2>Add Idea</h2>
    <form method="POST" action="/admin/ideas">
      <input name="title" placeholder="Title" required>
      ${categorySelect('category')}
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
    <form method="GET" action="/admin" style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <input type="text" name="search" value="${search ?? ''}" placeholder="Search by title...">
      ${categorySelect('category', filterCategory, true)}
      <button type="submit">Filter</button>
    </form>
    ${activeRows}
    ${paginationControls}
    <details>
      <summary>Archived</summary>
      ${archivedRows}
    </details>
  `)
}

type ReviewWithTopic = Review & { title: string; category: string | null; url: string | null }

export function reviewsPage(
  reviews: ReviewWithTopic[],
  page = 1,
  total?: number,
  pageSize = 20,
): string {
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1

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
          <details style="margin-top:0.5rem">
            <summary>Edit</summary>
            <form method="POST" action="/admin/reviews/${r.id}/edit">
              <textarea name="pros" placeholder="Pros">${r.pros ?? ''}</textarea>
              <textarea name="cons" placeholder="Cons">${r.cons ?? ''}</textarea>
              <input name="rating" type="number" min="1" max="10" value="${r.rating ?? ''}">
              <textarea name="verdict" placeholder="Verdict">${r.verdict ?? ''}</textarea>
              <button type="submit" class="outline">Save</button>
            </form>
          </details>
          <footer><small>Reviewed: ${r.reviewed_at}</small></footer>
        </article>`).join('')

  const paginationControls = total !== undefined && totalPages > 1 ? `
    <div style="display:flex;gap:0.5rem;align-items:center;margin:1rem 0">
      ${page > 1 ? `<a href="/admin/reviews?page=${page - 1}"><button class="outline">← Prev</button></a>` : ''}
      <span>Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/admin/reviews?page=${page + 1}"><button class="outline">Next →</button></a>` : ''}
    </div>` : ''

  return adminLayout('Reviews', 'reviews', `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>Review History</h2>
      <div style="display:flex;gap:0.5rem">
        <a href="/admin/reviews/export.csv"><button class="outline">Export CSV</button></a>
        <a href="/admin/reviews/export.json"><button class="outline">Export JSON</button></a>
      </div>
    </div>
    ${cards}
    ${paginationControls}
  `)
}
