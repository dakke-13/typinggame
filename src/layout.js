const { html } = require('hono/html');

function layout(c, title, body) {
  return html`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <link rel="stylesheet" href="/stylesheets/style.css" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            --green: #39C5BB;
            --pink: #E12885;
            ---dark: #333333;
            --bg: #F0F8F8; /* ほんのり青緑がかった白 */
          }

          body {
            font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
            background-color: var(--bg);
            color: var(--dark);
            margin: 0;
            padding: 0;
          }

          /* 全ページ共通ヘッダー */
          header {
            background-color: var(--green);
            padding: 15px 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            position: sticky; 
            top: 0;
            z-index: 1000;
          }
          header a {
            color: white;
            text-decoration: none;
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          header a:hover {
            color: var(--pink); 
            transition: color 0.3s;
          }
          main {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
          }
        </style>
      </head>
      <body>
        <header>
          <a href="/">高難度英単語タイピング</a>
        </header>
        <main>
          ${body}
        </main> 
      </body>
    </html>
  `;
}

module.exports = layout;