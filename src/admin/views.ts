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

import type { Topic } from '../types.js'

export function ideasPage(topics: Topic[], flash?: string): string {
  const active = topics.filter(t => t.status === 'pending' || t.status === 'skipped')

  const topicRows = active.length === 0
    ? '<p>No ideas yet — add one below!</p>'
    : active.map(t => `
      <article>
        <header><strong>${t.title}</strong> <small>${t.status}${t.skip_count > 0 ? ` (skipped ${t.skip_count}x)` : ''}</small></header>
        ${t.category ? `<p>Category: ${t.category}</p>` : ''}
        ${t.url ? `<p><a href="${t.url}" target="_blank">${t.url}</a></p>` : ''}
      </article>
    `).join('')

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
    <h2>Ideas</h2>
    ${topicRows}
  `)
}

export function adminLayout(title: string, activePage: 'ideas' | 'reviews', body: string): string {
  return layout(title, `
    <nav>
      <ul>
        <li><strong>Cookie Jar</strong></li>
      </ul>
      <ul>
        <li><a href="/admin" ${activePage === 'ideas' ? 'aria-current="page"' : ''}>Ideas</a></li>
        <li><a href="/admin/reviews" ${activePage === 'reviews' ? 'aria-current="page"' : ''}>Reviews</a></li>
      </ul>
    </nav>
    ${body}
  `)
}
