const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const wordsData = require('./words.json')
const ensureAuthenticated = require('../middlewares/ensure-authenticated');

const app = new Hono();
app.use(ensureAuthenticated());

//単語データを渡す
app.get('/api/words', (c) => {
  return c.json(wordsData);
});


app.get('/new', (c) => {
  return c.html(
    layout(
      c,
      'タイピングゲーム',
      html`
      <style>

        /* ゲーム画面専用のパーツデザイン */
        .title { 
          color: var(--green); 
          text-align: center; 
          font-size: 36px; 
          text-shadow: 2px 2px 0px rgba(57, 197, 187, 0.2); 
          margin-bottom: 10px; 
        }
        
        /* 履歴リンク */
        .link-history { 
          color: var(--green); 
          text-decoration: none; 
          font-weight: bold; 
          font-size: 16px;
          transition: color 0.2s; 
        }
        .link-history:hover { color: var(--pink); }

        /* スコアと時間の表示 */
        .hud-box {
          background-color: white;
          color: var(--dark);
          border: 3px solid var(--green);
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 24px;
          font-weight: bold;
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(57, 197, 187, 0.2); 
        }
        .hud-score { color: var(--green); font-size: 32px; }
        .hud-time { color: var(--pink); font-size: 32px; }

        /* ゲームの出題エリア */
        .game-area {
          background-color: white;
          padding: 50px 20px;
          border-radius: 15px;
          box-shadow: 0 4px 20px rgba(57, 197, 187, 0.15);
          border-top: 5px solid var(--green);
          margin-bottom: 40px;
          min-height: 150px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        #target {
          font-size: 54px;
          font-family: 'Courier New', Consolas, monospace; 
          font-weight: bold;
          letter-spacing: 3px;
          color: var(--dark);
          margin-bottom: 15px;
        }
        
        #translation {
          font-size: 20px;
          color: #888;
          font-weight: bold;
        }

        /* スタートボタン */
        .btn-start { 
          background-color: var(--pink); 
          color: white; 
          font-size: 24px; 
          font-weight: bold; 
          border: none; 
          padding: 15px 60px; 
          border-radius: 50px; 
          cursor: pointer; 
          box-shadow: 0 4px 10px rgba(225, 40, 133, 0.3); 
          transition: all 0.2s; 
        }
        .btn-start:hover:not(:disabled) { transform: scale(1.05); }
        .btn-start:disabled { background-color: #ccc; box-shadow: none; cursor: not-allowed; }
      </style>

      <div style="max-width: 750px; margin: 0 auto; text-align: center;">
        <h1 class="title">タイピングゲーム</h1>
        
        <div style="margin-bottom: 30px;">
          <a href="/score/scores" class="link-history"> 自分のスコア履歴を見る</a>
        </div>

        <!-- スコアと残り時間（HUD） -->
        <div class="hud-box">
          <div>スコア: <span id="score" class="hud-score">0</span> 点</div>
          <div>残り時間: <span id="time" class="hud-time">30</span> 秒</div>
        </div>

        <!-- 画面に単語を表示する場所 -->
        <div class="game-area">
          <div id="target">スタートボタンを押してね</div>
          <div id="translation"></div>
        </div>

        <!-- スタートボタン -->
        <div>
          <button id="start-button" class="btn-start" disabled>準備中...</button>
        </div>
      </div>
      
 

      <!-- javascript -->
      <script>
      <!--単語の読み込み-->
    let words = [];
      fetch('/game/api/words')
        .then((response) => response.json())
        .then(data => {
          words = data;

          startButton.disabled = false;
          startButton.textContent = 'ゲームスタート！';
          target.innerHTML = 'スタートボタンを押してね';
          })
          .catch(error => {
            console.error('単語の読み込みに失敗しました:', error);
            target.innerHTML = '<span style="color: red;">エラー：単語データが読み込めませんでした</span>';
            });

    let selectedWord="";
    let loc = 0;

    //スコア、時間
    let score = 0;
    let timeLeft =30;
    let isPlaying = false;
    let timerId

    const target = document.getElementById('target');
    const translationElement = document.getElementById('translation');
    const scoreElement = document.getElementById('score');
    const timeElement = document.getElementById('time');
    const startButton = document.getElementById('start-button')

    function updateTarget(){
      // 打ち終わった部分
      const typed = selectedWord.substring(0, loc);
      // まだ打っていない部分
      const untyped = selectedWord.substring(loc);

      // HTMLを書き換える
      target.innerHTML = '<span style="color: lightgray;">' + typed + '</span>' + untyped;
    }



    // ランダムに単語をセットする関数
    function setNextWord(){
      const randomIndex = Math.floor(Math.random() * words.length);
      selectedWord = words[randomIndex].en;
      translationElement.textContent = words[randomIndex].ja;
      loc = 0;
      
      updateTarget();
    }
    
    //この関数が呼ばれた時にタイマーをセット
    function startTimer() {
      timerId = setInterval(() => {
        timeLeft -= 1;
        timeElement.textContent = timeLeft; // 画面を更新
        
        // 0秒になったらゲーム終了
        if(timeLeft <= 0) {
            clearInterval(timerId);
            isPlaying = false;
            target.innerHTML = "終了！スコアを保存中..." // 終了メッセージ
            translationElement.textContent = ""; // 終了時は日本語訳を消す

            //  サーバーにスコアを送信する処理
            fetch('score', {
                method: 'POST', 
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ score: score }) // スコアをJSON形式にして送る
              })
              .then((response) => {
                if(response.ok) {
                  target.innerHTML = "終了！あなたのスコアは " + score + " 点です！<br>（保存完了）";
                } else {
                  target.innerHTML = "スコアの保存に失敗しました...";
                }
                
                // ボタンを復活させる
                startButton.style.display = 'inline-block';
                startButton.textContent = 'もう一度遊ぶ';
              })
              .catch((error) => {
                console.error('エラー:', error);
              });
            }
          }, 1000);
    }

    //スタートボタンがクリックされた時の処理
    startButton.addEventListener('click', () => {
      //リセット
      score = 0;
      timeLeft = 30;
      scoreElement.textContent = score;
      timeElement.textContent = timeLeft;
      translationElement.textContent = "";
      //ゲームの状態をON
      isPlaying = true;
      //ボタンを画面から隠す
      startButton.style.display = 'none';

      //始まるぞ
      setNextWord();
      startTimer();
    });



    

    //キーボード入力の判定
    document.addEventListener('keydown', (e) => {
      //もしゲーム終了なら、ここで処理を止める
      if(isPlaying === false) {
       return;
      }
      if( selectedWord[loc] === e.key) {
          loc += 1;

          //正解するとスコアを増やして更新(1文字10点)
          score += 10;
          scoreElement.textContent = score;
          updateTarget();
          if(loc === selectedWord.length) {
            setNextWord();
          }
      } else {
        //ミスした時の処理
        score -= 10;
        scoreElement.textContent = score;
      }
    });
    </script>      
      `,
    ),
  );
});



app.post('/score', async (c) => {
  try {
    // 1. ブラウザから送られてきたJSONデータ(スコア)を受け取る
    const body = await c.req.json();
    const currentScore = body.score;

    // 2. ログイン中のユーザー情報を取得する

    const session = c.get('session'); 
    
    // ユーザー情報がない場合はエラーを返す
    if (!session || !session.user || !session.user.id) {
      return c.json({ error: '認証されていません' }, 401);
    }
    const userId = session.user.id;

    console.log(`User ID: ${userId} が ${currentScore} 点を獲得しました！`);

    await prisma.score.create({
    data: {
  scoreId    : randomUUID(),
  typingScore : currentScore,
  createdBy   : userId,
  updatedAt   : new Date(),
    }
    });

    return c.json({ success: true });

  } catch (error) {
    console.error(error);
    return c.json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});



module.exports = app;
