import type { Topic, Review } from '../types.js'

export const CATEGORIES = [
  'Frontend', 'Backend', 'JS runtime', 'AI tooling', 'AI model',
  'Database', 'Testing', 'UI', 'State management', 'Auth', 'CSS',
  'Build tool', 'System design', 'Other',
]

const picoCSS = 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css'

const CSS_OVERRIDES = `
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --accent: #6366f1;
    --accent-hover: #4f46e5;
    --text: #1e293b;
    --muted: #64748b;
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --radius-card: 10px;
    --radius-input: 6px;
    --shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; margin: 0; }
  main.container { max-width: 960px; margin: 0 auto; padding: 0 1rem 2rem; }

  /* Nav */
  nav.topnav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(248,250,252,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 1rem; height: 52px;
    margin-bottom: 1.5rem;
  }
  nav.topnav .brand { font-weight: 700; font-size: 1rem; color: var(--text); text-decoration: none; }
  nav.topnav .nav-links { display: flex; gap: 1.25rem; list-style: none; margin: 0; padding: 0; }
  nav.topnav .nav-links a { color: var(--muted); text-decoration: none; font-size: 0.875rem; font-weight: 500; }
  nav.topnav .nav-links a:hover { color: var(--text); }
  nav.topnav .nav-links a[aria-current="page"] { font-weight: 600; color: var(--accent); }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 1.25rem; box-shadow: var(--shadow); margin-bottom: 1.25rem; }
  .section-title { font-size: 0.875rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.75rem; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 1rem; box-shadow: var(--shadow); text-align: center; }
  .stat-val { font-size: 1.6rem; font-weight: 700; color: var(--text); line-height: 1; }
  .stat-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.25rem; }
  @media (max-width: 480px) { .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 0.5rem; } .stat-val { font-size: 1.2rem; } }

  /* Buttons */
  button.btn, a.btn {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.45rem 0.9rem; border-radius: var(--radius-input);
    font-size: 0.875rem; font-weight: 500; cursor: pointer;
    border: 1px solid transparent; text-decoration: none;
    transition: all 0.15s; white-space: nowrap;
    font-family: inherit; line-height: 1.4;
  }
  button.btn-sm, a.btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }
  button.btn-primary, a.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  button.btn-primary:hover, a.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  button.btn-outline, a.btn-outline { background: var(--surface); color: var(--text); border-color: var(--border); }
  button.btn-outline:hover, a.btn-outline:hover { background: var(--bg); }
  button.btn-ghost, a.btn-ghost { background: transparent; color: var(--muted); border-color: transparent; }
  button.btn-ghost:hover, a.btn-ghost:hover { background: #f1f5f9; color: var(--text); }
  button.btn-danger, a.btn-danger { background: #fff5f5; color: #dc2626; border-color: #fecaca; }
  button.btn-danger:hover, a.btn-danger:hover { background: #fef2f2; }

  /* Forms */
  input, select, textarea {
    width: 100%; padding: 0.45rem 0.65rem; border: 1px solid var(--border);
    border-radius: var(--radius-input); font-size: 0.875rem; font-family: inherit;
    background: var(--surface); color: var(--text);
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

  /* Idea form */
  .idea-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .idea-form input[name="title"] { grid-column: 1 / -1; }
  .idea-form button { grid-column: 1 / -1; justify-self: start; }
  @media (max-width: 640px) { .idea-form { grid-template-columns: 1fr; } }

  /* Action bar */
  .action-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }

  /* Filter bar */
  .filter-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
  .filter-bar select { width: auto; }
  .filter-bar input { flex: 1; min-width: 120px; }

  /* Table */
  .ideas-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius-card); overflow: hidden; box-shadow: var(--shadow); }
  .ideas-table th { background: var(--bg); padding: 0.6rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; text-align: left; border-bottom: 1px solid var(--border); }
  .ideas-table td { padding: 0.6rem 0.75rem; font-size: 0.875rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  .ideas-table tr:last-child td { border-bottom: none; }
  .ideas-table tr:hover td { background: var(--bg); }
  .ideas-table .url-link { font-size: 0.75rem; color: var(--muted); }
  .ideas-table .url-link a { color: var(--accent); text-decoration: none; }
  .ideas-table .url-link a:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    .ideas-table { display: block; }
    .ideas-table thead { display: none; }
    .ideas-table tbody { display: block; }
    .ideas-table tr {
      display: block;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      margin-bottom: 0.75rem;
      padding: 0.5rem 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .ideas-table td {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.3rem 0;
      border: none;
      font-size: 0.875rem;
    }
    .ideas-table td::before {
      content: attr(data-label);
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      min-width: 80px;
      padding-top: 2px;
    }
    .ideas-table td[data-label="Actions"] { flex-direction: column; gap: 0.5rem; }
  }

  /* Badges */
  .badge { display: inline-block; padding: 0.18em 0.55em; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }

  /* Pagination */
  .pagination { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0; }
  .page-info { font-size: 0.8rem; color: var(--muted); }

  /* Archived section */
  .archived-section { margin-top: 1.5rem; }
  .archived-section > summary { cursor: pointer; font-size: 0.875rem; color: var(--muted); list-style: none; padding: 0.25rem 0; }
  .archived-section > summary::-webkit-details-marker { display: none; }
  .archived-section > summary::before { content: '▶ '; font-size: 0.65rem; }
  .archived-section[open] > summary::before { content: '▼ '; }
  .archived-list { list-style: none; padding: 0.5rem 0 0; margin: 0; }
  .archived-list li { padding: 0.3rem 0; font-size: 0.875rem; color: var(--muted); border-bottom: 1px solid var(--border); }
  .archived-list li:last-child { border-bottom: none; }

  /* Review cards */
  .review-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 1.25rem; box-shadow: var(--shadow); margin-bottom: 1rem; }
  .review-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
  .review-title { font-weight: 600; font-size: 1rem; }
  .review-rating { font-size: 2rem; font-weight: 700; line-height: 1; }
  .review-rating.green { color: #16a34a; }
  .review-rating.amber { color: #d97706; }
  .review-rating.red { color: #dc2626; }
  .review-footer { font-size: 0.75rem; color: var(--muted); margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; }

  /* Page header row */
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .page-header h2 { margin: 0; font-size: 1.1rem; }

  /* Flash */
  .admin-flash { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 0.6rem 0.9rem; border-radius: var(--radius-input); margin-bottom: 1rem; font-size: 0.875rem; }
`

const layout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Cookie Jar</title>
  <link rel="stylesheet" href="${picoCSS}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍪</text></svg>">
  <style>${CSS_OVERRIDES}</style>
</head>
<body>
  ${body}
</body>
</html>`

export function adminLayout(title: string, activePage: 'ideas' | 'reviews', body: string): string {
  return layout(title, `
    <nav class="topnav">
      <a class="brand" href="/admin">🍪 Cookie Jar</a>
      <ul class="nav-links">
        <li><a href="/admin" ${activePage === 'ideas' ? 'aria-current="page"' : ''}>Ideas</a></li>
        <li><a href="/admin/reviews" ${activePage === 'reviews' ? 'aria-current="page"' : ''}>Reviews</a></li>
      </ul>
    </nav>
    <main class="container">
      ${body}
    </main>
  `)
}

export function loginPage(error?: string): string {
  return layout('Login', `
    <main class="container" style="max-width:400px;padding-top:4rem">
      <div class="card">
        <h2 style="margin:0 0 1rem;font-size:1.25rem">Cookie Jar Admin</h2>
        ${error ? `<p style="color:red;margin-bottom:0.75rem">${error}</p>` : ''}
        <form method="POST" action="/admin/login">
          <label style="display:block;margin-bottom:0.5rem;font-size:0.875rem;font-weight:500">Password</label>
          <input type="password" name="password" placeholder="Enter password" autofocus required style="margin-bottom:0.75rem">
          <button type="submit" class="btn btn-primary" style="width:100%">Log in</button>
        </form>
      </div>
    </main>
  `)
}

function statusBadge(status: string): string {
  const styles: Record<string, string> = {
    pending:  'background:#d1fae5;color:#065f46',
    skipped:  'background:#fed7aa;color:#9a3412',
    archived: 'background:#e5e7eb;color:#374151',
  }
  const style = styles[status] ?? 'background:#e5e7eb;color:#374151'
  return `<span class="badge" style="${style}">${status}</span>`
}

function categorySelect(name: string, current?: string | null, includeAll = false): string {
  const allOption = includeAll ? '<option value="">All categories</option>' : ''
  const options = CATEGORIES.map(c =>
    `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`
  ).join('')
  return `<select name="${name}">${allOption}${options}</select>`
}

function topicRow(t: Topic): string {
  const editForm = t.status === 'pending' ? `
    <details style="margin-top:0.25rem">
      <summary class="btn btn-outline btn-sm" style="cursor:pointer;list-style:none;display:inline-flex">Edit</summary>
      <form method="POST" action="/admin/ideas/${t.id}/edit" style="margin-top:0.5rem;display:grid;gap:0.4rem">
        <input name="title" value="${t.title}" placeholder="Title" required>
        ${categorySelect('category', t.category)}
        <input name="description" value="${t.description ?? ''}" placeholder="Description (optional)">
        <input name="url" value="${t.url ?? ''}" placeholder="URL (optional)">
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
      </form>
    </details>` : ''

  return `
    <tr>
      <td data-label="Title">
        <div>
          <strong>${t.title}</strong>
          ${t.url ? `<div class="url-link"><a href="${t.url}" target="_blank">${t.url}</a></div>` : ''}
        </div>
      </td>
      <td data-label="Category">${t.category ?? '<span style="color:var(--muted)">—</span>'}</td>
      <td data-label="Status">${statusBadge(t.status)}${t.skip_count > 0 ? `<small style="color:var(--muted)"> (${t.skip_count}x)</small>` : ''}</td>
      <td data-label="Actions">
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center">
          <form method="POST" action="/admin/ideas/${t.id}/skip" style="display:inline">
            <button type="submit" class="btn btn-outline btn-sm">Skip</button>
          </form>
          <form method="POST" action="/admin/ideas/${t.id}/delete" style="display:inline">
            <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete this topic?')">Delete</button>
          </form>
          ${editForm}
        </div>
      </td>
    </tr>`
}

function topicTable(rows: string, pagination: string, searchForm: string): string {
  return `
    ${searchForm}
    <table class="ideas-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    ${pagination}`
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
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">${stats.total}</div>
        <div class="stat-label">Total topics</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.reviewed}${avgText}</div>
        <div class="stat-label">Reviews done</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.pending} / ${stats.skipped}</div>
        <div class="stat-label">Pending / Skipped</div>
      </div>
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

  const searchParams = `search=${encodeURIComponent(search ?? '')}&category=${encodeURIComponent(filterCategory ?? '')}`

  const paginationControls = totalActive !== undefined && totalPages > 1 ? `
    <div class="pagination">
      ${page > 1 ? `<a href="/admin?page=${page - 1}&${searchParams}" class="btn btn-ghost btn-sm">← Prev</a>` : ''}
      <span class="page-info">Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/admin?page=${page + 1}&${searchParams}" class="btn btn-ghost btn-sm">Next →</a>` : ''}
    </div>` : ''

  const searchForm = `
    <form method="GET" action="/admin" class="filter-bar">
      <input type="text" name="search" value="${search ?? ''}" placeholder="Search…" style="flex:1">
      ${categorySelect('category', filterCategory, true)}
      <button type="submit" class="btn btn-outline btn-sm">Filter</button>
      <a href="/admin/ideas/export.json" class="btn btn-ghost btn-sm">↓ JSON</a>
    </form>`

  const tableRows = active.length === 0
    ? ''
    : active.map(topicRow).join('')

  const activeSection = active.length === 0
    ? '<p>No ideas yet — add one below!</p>'
    : topicTable(tableRows, paginationControls, searchForm)

  const archivedItems = archived.length === 0
    ? '<p style="font-size:0.875rem;color:var(--muted)">No archived topics.</p>'
    : `<ul class="archived-list">${archived.map(t => `<li><strong>${t.title}</strong> <span style="font-size:0.75rem">(skipped ${t.skip_count}x)</span></li>`).join('')}</ul>`

  return adminLayout('Ideas', 'ideas', `
    ${flash ? `<div role="alert">${flash}</div>` : ''}
    ${stats ? statsCards(stats) : ''}

    <section class="card">
      <h3 class="section-title">Add Idea</h3>
      <form method="POST" action="/admin/ideas" class="idea-form">
        <input name="title" placeholder="Title" required>
        ${categorySelect('category')}
        <input name="description" placeholder="Description (optional)">
        <input name="url" placeholder="URL (optional)">
        <button type="submit" class="btn btn-primary">Add idea</button>
      </form>
    </section>

    <div class="action-bar">
      <form method="POST" action="/admin/send-weekly"><button type="submit" class="btn btn-primary btn-sm">Send weekly</button></form>
      <form method="POST" action="/admin/send-review-prompt"><button type="submit" class="btn btn-outline btn-sm">Review prompt</button></form>
      <form method="POST" action="/admin/send-reminder"><button type="submit" class="btn btn-outline btn-sm">Reminder</button></form>
    </div>

    <div class="page-header">
      <h2>Ideas</h2>
    </div>

    ${active.length === 0 ? searchForm : ''}
    ${activeSection}

    <details class="archived-section">
      <summary>Archived topics (${archived.length})</summary>
      ${archivedItems}
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
    : reviews.map(r => {
        const ratingClass = r.rating >= 8 ? 'green' : r.rating >= 5 ? 'amber' : 'red'
        return `
        <div class="review-card">
          <div class="review-header">
            <div>
              <div class="review-title">${r.title}</div>
              ${r.category ? `<span class="badge" style="background:#e0e7ff;color:#3730a3;margin-top:0.25rem">${r.category}</span>` : ''}
            </div>
            <div class="review-rating ${ratingClass}">${r.rating}/10</div>
          </div>
          ${r.url ? `<p style="font-size:0.875rem;margin:0.25rem 0"><a href="${r.url}" target="_blank" style="color:var(--accent)">${r.url}</a></p>` : ''}
          <p style="margin:0.4rem 0;font-size:0.875rem"><strong>Pros:</strong> ${r.pros ?? '—'}</p>
          <p style="margin:0.4rem 0;font-size:0.875rem"><strong>Cons:</strong> ${r.cons ?? '—'}</p>
          <p style="margin:0.4rem 0;font-size:0.875rem"><strong>Verdict:</strong> ${r.verdict ?? '—'}</p>
          <details style="margin-top:0.5rem">
            <summary style="cursor:pointer;font-size:0.8rem;color:var(--muted)">Edit</summary>
            <form method="POST" action="/admin/reviews/${r.id}/edit" style="margin-top:0.5rem;display:grid;gap:0.4rem">
              <textarea name="pros" placeholder="Pros">${r.pros ?? ''}</textarea>
              <textarea name="cons" placeholder="Cons">${r.cons ?? ''}</textarea>
              <input name="rating" type="number" min="1" max="10" value="${r.rating ?? ''}" placeholder="Rating (1–10)">
              <textarea name="verdict" placeholder="Verdict">${r.verdict ?? ''}</textarea>
              <button type="submit" class="btn btn-outline btn-sm">Save</button>
            </form>
          </details>
          <div class="review-footer">
            <small>Reviewed: ${r.reviewed_at}</small>
            <form method="POST" action="/admin/reviews/${r.id}/delete" style="display:inline">
              <button class="btn btn-danger btn-sm" onclick="return confirm('Delete this review?')">Delete</button>
            </form>
          </div>
        </div>`
      }).join('')

  const paginationControls = total !== undefined && totalPages > 1 ? `
    <div class="pagination">
      ${page > 1 ? `<a href="/admin/reviews?page=${page - 1}" class="btn btn-ghost btn-sm">← Prev</a>` : ''}
      <span class="page-info">Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/admin/reviews?page=${page + 1}" class="btn btn-ghost btn-sm">Next →</a>` : ''}
    </div>` : ''

  return adminLayout('Reviews', 'reviews', `
    <div class="page-header">
      <h2>Review History</h2>
      <div style="display:flex;gap:0.75rem;align-items:center">
        <a href="/admin/reviews/export.csv" class="btn btn-ghost btn-sm">↓ CSV</a>
        <a href="/admin/reviews/export.json" class="btn btn-ghost btn-sm">↓ JSON</a>
      </div>
    </div>
    ${cards}
    ${paginationControls}
  `)
}
