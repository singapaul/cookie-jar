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
