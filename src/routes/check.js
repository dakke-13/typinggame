// check.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 データベースを検索中...");

  // WordRequest（受付箱）のデータを全件取得する
  const requests = await prisma.wordRequest.findMany();

  // 取得したデータをコンソールに綺麗に表示する（console.tableが便利です！）
  console.log("▼ リクエストされた英単語一覧");
  console.table(requests);
}

// 実行して、終わったらPrismaの接続を閉じる
main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });