'use strict';

const { Hono } = require('hono');
const { logger } = require('hono/logger');
const { html } = require('hono/html');
const { HTTPException } = require('hono/http-exception');
const { secureHeaders } = require('hono/secure-headers');
const { env } = require('hono/adapter');
const { serveStatic } = require('@hono/node-server/serve-static');
const { trimTrailingSlash } = require('hono/trailing-slash');
const { githubAuth } = require('@hono/oauth-providers/github');
const { getIronSession } = require('iron-session');
const { PrismaClient } = require( '@prisma/client');
const layout = require('./layout');

const prisma = new PrismaClient({ log: [ 'query' ] });
const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');
const gameRouter = require('./routes/game');
const scoresRouter = require('./routes/scores');

const app = new Hono();

app.use(logger());
app.use(serveStatic({ root: './public' }));
app.use(secureHeaders());
app.use(trimTrailingSlash());

// セッション管理用のミドルウェア
app.use(async (c, next) => {
  const { SESSION_PASSWORD } = env(c);
  const dummyRes = new Response();
  
  const session = await getIronSession(c.req.raw, dummyRes, {
    password: SESSION_PASSWORD,
    cookieName: 'session',
    cookieOptions: {
      // 念のため、Render環境であることをより確実に判定する書き方に強化します
      secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true",
      httpOnly: true,
      sameSite: "lax"
    },
  });
  
  c.set('session', session);
  await next();
  
  const setCookieValue = dummyRes.headers.get('set-cookie');
  if (setCookieValue) {
    // 💡 今回の修正ポイント 💡
    // リダイレクトの「カチカチのレスポンス」を、コピーして「編集可能なレスポンス」に作り直します！
    c.res = new Response(c.res.body, c.res);
    
    // そのうえでCookieを貼り付けます！
    c.res.headers.append('set-cookie', setCookieValue);
  }
});

//GitHub 認証
app.use('/auth/github', async (c, next) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env(c);
  const authHandler = githubAuth({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    scope: ['user:email'],
    oauthApp: true,
  });
  return await authHandler(c, next);
});

//  GitHub 認証の後の処理
app.get('/auth/github', async (c) => {
  const session = c.get('session');
  const githubUser = c.get('user-github');
  session.user = {
    id: githubUser.id,
    login: githubUser.login
  }
  await session.save();

  // ユーザ情報をデータベースに保存
  const userId = session.user.id;
  const data = {
    userId,
    username: session.user.login
  };
  await prisma.user.upsert({
    where: { userId },
    update: data,
    create: data,
  })
  return c.redirect('/');
});
//　ルーティング
app.route('/', indexRouter);
app.route('/login', loginRouter);
app.route('/logout', logoutRouter);
app.route('/game', gameRouter);
app.route('/score', scoresRouter);
//404 Not Found
app.notFound((c) => {
  return c.html(
    layout(
      c,
      'Not Found',
      html`
      <h1>Not Found</h1>
      <p>${c.req.url} の内容が見つかりませんでした。</p>
      `,
    ),
    404,
  );
});

//エラーハンドリング
app.onError((error,c) =>{
  console.error(error);
  const statusCode = error instanceof HTTPException ? error.status : 500;
  const { NODE_ENV } = env(c);
  return c.html(
    layout(
      c,
      'Error',
      html`
      <h1>Error</h1>
      <h2>${error.name} (${statusCode})</h2>
      <p>${error.message}</p>
      ${NODE_ENV === 'development' ? html`<pre>
        ${error.stack}</pre>` : ''}
      `,
    ),
    statusCode,
  );
});

module.exports = app;

