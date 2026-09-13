const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();



app.get('/', async (c) => {
  const { user } = c.get('session') ?? {};

  //データベースからスコア上位10件を取得する
  const topScores = await prisma.score.findMany({
    take: 10,
    orderBy: {
      typingScore: 'desc',
    },
    include: {
      user: true 
    }
  });

  
  //ターミナルに中身を出力する
  console.log("取れたデータ:", topScores);

  return c.html(
    layout(
      c,
      '英単語タイピング',
      html`
        <style>
          /* トップページ専用のパーツデザイン */
          .title { 
            color: var(--green); 
            text-align: center; 
            font-size: 42px; 
            text-shadow: 2px 2px 0px rgba(57, 197, 187, 0.2); 
            margin-bottom: 10px; 
          }
          .subtitle { text-align: center; color: #666; margin-bottom: 40px; line-height: 1.6; }
          
          /* スタートボタン */
          .btn-play { 
            display: inline-block; 
            background-color: var(--pink); 
            color: white; 
            font-size: 22px; 
            font-weight: bold; 
            text-decoration: none; 
            padding: 15px 50px; 
            border-radius: 50px; 
            box-shadow: 0 4px 10px rgba(225, 40, 133, 0.3); 
            transition: transform 0.2s; 
          }
          .btn-play:hover { transform: scale(1.05); }

          /* テーブルのデザイン */
          .ranking-table { width: 100%; border-collapse: collapse; margin-bottom: 50px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .ranking-table th { background-color: white; color: var(--dark)); padding: 15px; }
          .ranking-table td { padding: 12px 15px; border-bottom: 1px solid #eee; }
          
          /* リクエストフォームのデザイン */
          .request-box { background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(57, 197, 187, 0.15); border-top: 5px solid var(--green); }
          .btn-submit { background-color: var(--green); color: white; border: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
          .btn-submit:hover { background-color: #2eb0a6; }
          .input-field { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; }
        </style>





        <div style="max-width: 600px; margin: 0 auto;">
          <h1 class="title">高難度英単語タイピング</h1>
          <p class="subtitle">
          普段使わないような英単語を集めてタイピングゲームにしました。<br> 馴染みのない英単語を覚えたい方は是非。
          </p>
          <div style="text-align: center; margin-bottom: 50px;">
          ${user
            ? html`
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="margin-bottom: 20px;">ようこそ、${user.login} さん！</h2>
              <a href="/game/new" class="btn-play">
              ▶ ゲームを始める
            </a>
            <div style="margin-top: 20px;">
              <a href="/logout" class="btn-play" style="background-color: var(--green);">ログアウト</a>
            </div>
            </div>
            `
            : html`
              <a href="/login" class="btn-play" style="background-color: var(--green);">ログインして挑戦する</a>
            `}
            </div>

            <!-- 取得したデータをHTMLに埋め込む -->
            <h2 style="color: var(--dark); border-bottom: 3px solid var(--green); padding-bottom: 5px;"> 歴代トップスコア</h2>
            <table class="ranking-table">
              <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                <th>スコア</th>
              </tr>

              ${topScores.map((score, index) => {
                // 順位
                let rank = index + 1;
                let rankText = rank + "位";
                return html`
                <tr>
                  <td style="font-weight: bold; color: var(--green);">${rankText}</td>
                  <td>
                    ${score.user ? score.user.username : '退会したユーザー'}
                  </td>
                  <td style="font-weight: bold;">${score.typingScore}</td>
                </tr>
                `;
              })}
            </table>
              <div class="request-box">
                <h3 style="margin-top: 0; color: var(--green);">英単語をリクエストする</h3>
                <p style="font-size: 14px; color: #555;">
                  ゲームに追加してほしい英単語を教えてください。管理者が確認して採用するかもしれません！
                </p>
                
                <form action="/request-word" method="POST">
                  <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px;">英単語:</label>
                    <input type="text" name="en" required class="input-field" placeholder="例: onomatopoeia">
                  </div>
                  <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px;">日本語訳:</label>
                    <input type="text" name="ja" required class="input-field" placeholder="例: 擬音語">
                  </div>
                  <div style="text-align: right;">
                    <button type="submit" class="btn-submit">
                      リクエストを送信する
                    </button>
                  </div>
                </form>
            </div>           
        </div>
      `,
    ),
  );
});

app.post('/request-word', async (c) => {
   try{ 
    // フォームに入力されたデータを取り出す
    const body = await c.req.parseBody();

    if (!body.en || !body.ja) {
      return c.text('英単語と日本語訳の両方を入力してください。', 400);
    }
    const enText = String(body.en);
    const jaText = String(body.ja);
    if (enText.length > 50 || jaText.length > 50) {
      return c.text('文字数が長すぎます。50文字以内で入力してください。', 400);
    }
    // データベースに保存する
    await prisma.wordRequest.create({
      data: {
        en: body.en,
        ja: body.ja
      }
  });
  return c.redirect('/');
} catch(error){
    console.error('リクエスト保存中にエラーが発生しました:', error);
    return c.text('サーバーエラーが発生しました。時間を置いてやり直してください。', 500);
}
});

module.exports = app;