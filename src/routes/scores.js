const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const app = new Hono();

app.use(ensureAuthenticated());

app.get('/scores', async (c) => {
  //  ログイン中のユーザー情報を取得
  const session = c.get('session');
  const userId = session.user.id;

  //  データベースから自分のスコアを取得する（高い順に20件）
  const myScores = await prisma.score.findMany({
    where: { createdBy: userId },       
    orderBy: { typingScore: 'desc' },   
    take: 20                            
  });

  //  取得したデータをHTMLの表の形にする
  const tableRows = myScores.length > 0 
    ? myScores.map((score, index) => {
        // 日付を見やすい形式（日本時間）に変換
        const playDate = new Date(score.updatedAt).toLocaleString('ja-JP');
        return html`
          <tr>
            <td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${index + 1}位</td>
            <td style="padding: 10px; border: 1px solid #ccc; text-align: center;"><b>${score.typingScore} 点</b></td>
            <td style="padding: 10px; border: 1px solid #ccc;">${playDate}</td>
          </tr>
        `;
      })
    : html`<tr><td colspan="3" style="text-align: center; padding: 20px;">まだスコアがありません。遊んでみてね！</td></tr>`;

  // 4. 画面を表示する
  return c.html(
    layout(
      c,
      'マイランキング',
      html`
      <style>
        /* ページ全体のコンテナ */
        .page-container {
          max-width: 650px;
          margin: 0 auto;
        }

        /* タイトルのデザイン */
        .title { 
          color: var(--green); 
          text-align: center; 
          font-size: 36px; 
          text-shadow: 2px 2px 0px rgba(57, 197, 187, 0.2); 
          margin-bottom: 30px; 
          font-weight: 700;
        }

        /* 戻るボタン */
        .btn-back {
          display: inline-block;
          background-color: var(--green);
          color: white;
          font-size: 18px;
          font-weight: bold;
          text-decoration: none;
          padding: 12px 30px;
          border-radius: 50px;
          box-shadow: 0 4px 10px rgba(57, 197, 187, 0.3);
          transition: transform 0.2s;
        }
        .btn-back:hover { transform: scale(1.05); color: white; }

        /* テーブルのデザイン */
        .ranking-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 50px; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 15px rgba(57, 197, 187, 0.15); 
        }
        .ranking-table th { 
          background-color: white; 
          color: var(--dark); 
          padding: 15px; 
          text-align: center;
        }
        .ranking-table td { 
          padding: 15px; 
          border-bottom: 1px solid #eee; 
        }
      </style>


        <div class="page-container">

          <h1 class="title">あなたのスコア履歴（上位20件）</h1>
          
          <!-- ゲーム画面に戻るボタン -->
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="/game/new" class="btn-back">← ゲームに戻る</a>
          </div>

          <!-- スコアを表示する表 -->
          <table class="ranking-table">
            <thead>
              <tr>
                <th>順位</th>
                <th>スコア</th>
                <th>プレイ日時</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `
    )
  );
});

module.exports = app;