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
// セッション管理用のミドルウェア
app.use(async (c, next) => {
  const { SESSION_PASSWORD } = env(c);
  const dummyRes = new Response();
  
  const session = await getIronSession(c.req.raw, dummyRes, {
    password: SESSION_PASSWORD,
    // 💡 名前を変えて、古い壊れたCookieの影響をリセットします
    cookieName: 'miku-session-v2',
    cookieOptions: {
      secure: true, // Render（本番環境）確定なので true に固定します！
      httpOnly: true,
      sameSite: "lax",
      path: '/'
    },
  });
  
  c.set('session', session);
  await next();
  
  // 💡 ここからが「絶対にCookieをこぼさない」ための新しい移し替え処理です 💡
  let setCookies = [];
  
  // Node.jsの最新仕様（getSetCookie）が使える場合はそれを使う
  if (typeof dummyRes.headers.getSetCookie === 'function') {
    setCookies = dummyRes.headers.getSetCookie();
  } else {
    const cookieStr = dummyRes.headers.get('set-cookie');
    if (cookieStr) setCookies = [cookieStr];
  }

  // 念のため、何が取得できたかRenderのログに出力する（これで原因が丸裸になります）
  console.log("【チェック】ダミーから取り出したCookie:", setCookies);

  // Cookieが存在していれば、本物のレスポンスに貼り付ける
  if (setCookies.length > 0) {
    const newHeaders = new Headers(c.res.headers);
    for (const cookie of setCookies) {
      newHeaders.append('set-cookie', cookie);
    }
    
    // ヘッダーを新しくした完全なレスポンスを作り直して、c.res に上書き！
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: newHeaders
    });
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

