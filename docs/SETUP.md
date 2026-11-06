# 友達共有(Phase 2)セットアップ手順

**あなたが行う作業**は下の ①〜⑦ です。すべて無料枠で収まります。作業中に画面の名称が変わっている場合は、近い項目を探してください。

## ① GitHub への push を通す(最優先)
このリポジトリへの Claude の GitHub アクセスが無く、これまでの変更はまだ GitHub にありません。
- Claude GitHub App をインストール: https://github.com/apps/claude/installations/select_target
- または claude.ai の設定で GitHub を再接続
  
済んだら Claude に「push して」と伝えてください。

## ② Supabase プロジェクトを作る
1. https://supabase.com でアカウント作成(GitHub ログインで可)。
2. New project を作成。Plan は **Free**、Region は **Tokyo**(`ap-northeast-1`)がおすすめ。
3. Database password を決める(メモしておく。アプリでは使いません)。

## ③ テーブルとアクセス制御を作る
1. Dashboard 左の **SQL Editor** → New query。
2. `supabase/schema.sql` の中身を全部貼り付けて **Run**。エラーが出なければOK(何度実行しても安全です)。

## ④ メール確認を OFF にする(重要)
Authentication → Sign In / Providers → **Email** → **Confirm email を OFF**。
- ONのままだと確認メールが必要になりますが、無料の標準メール送信は回数制限が厳しく、友達がサインアップできません。
- メールアドレスは確認されないため、**⑦ のとおり、友達が登録し終えたら新規登録を締め切る**運用にします。

## ⑤ URL とキーを控える
Project Settings → **API**(または API Keys)
- `Project URL` → `VITE_SUPABASE_URL`
- `anon` / `publishable` key → `VITE_SUPABASE_ANON_KEY`
- ⚠ `service_role` / `secret` キーは**絶対にアプリやGitHubに入れない**でください。anon キーは公開前提で、データの守りは schema.sql のRLSが担当します。

## ⑥ 公開する(Cloudflare・無料)
リポジトリに `wrangler.jsonc` があるので、Cloudflare の「Workers」(Git 連携)でそのまま公開できます。

1. https://dash.cloudflare.com → Workers & Pages → Create → **Import a repository**(Git に接続)→ このリポジトリを選択。
2. プロジェクト名は **`kazukazu1005`**(`wrangler.jsonc` の `name` と同じにする。変えた場合は `wrangler.jsonc` の `name` も同じに直す)。
3. Build command: `npm run build` / Deploy command: `npx wrangler deploy` / ブランチ: `main`
4. **ビルド用の変数**に追加(Settings → Build → Variables and secrets):
   - `VITE_SUPABASE_URL` = ⑤のURL
   - `VITE_SUPABASE_ANON_KEY` = ⑤のanonキー
   - `NODE_VERSION` = `22`
   - ※「Build」側の変数です。実行時の変数(Variables)ではなく、ビルドのときに読まれる欄に入れる。
5. デプロイ。Settings → Domains & Routes で `workers.dev` の URL が有効になっていることを確認し、友達に共有する。
6. スマホで開き「ホーム画面に追加」するとアプリのように使えます。

(Pages プロジェクトで公開する場合は、Build command: `npm run build` / Build output directory: `dist` にして、同じ環境変数を入れる。)

(ローカルで試す場合は `.env.example` を `.env.local` にコピーして値を入れ、`npm run dev`。)

### 「共有は設定されていません」と出るとき
- Friends タブ(またはプロフィール)に、ビルドが受け取った設定の状態が出ます。`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が、それぞれ OK か Problem かを確認する。
- Problem の場合は、Cloudflare の **Settings → Build → Variables and secrets** に、名前を正確に入れて保存し、**ビルドし直す**。
- 「secret key」と出た場合は、サーバー用の秘密のキーを入れている。**publishable(anon)キー**に替える。
- 画面の最下部(Settings)に出る「built …」の時刻で、新しい版が開けているか確認できる(古い版を覚えていることがある)。

### 友達の記録が見えないとき
- ホームの上に「Some workouts could not be sent…」と理由つきの表示が出ていれば、自分の記録がサーバーに届いていません。理由の文章を控えて報告する。
- フィード(Friends タブ)にエラーが出る場合も、その文章を控えて報告する。
- 友達が登録してあって、お互いに記録を保存してあることを確認する(友達の記録は、友達が「保存した」ものだけが見える)。

## ⑦ 使い始める
1. 自分のアプリの **Friends** タブでアカウント作成 → ユーザー名を決める。
2. 「Your invite code」を友達にLINE等で送る。
3. 友達もアカウント作成し、Add a friend に**あなたのコードを入力**(これで双方向に友達になります)。
4. **全員の登録が終わったら**、Authentication → Sign In / Providers の **Allow new users to sign up** を OFF にして新規登録を締め切る。
5. サインインしていれば、**保存した記録はすべて自動で友達に共有**されます(共有のオン・オフはありません)。サインイン前に記録した分も、サインイン後に自動で送られます。友達でない人には見えません。
6. 記録を削除すると、友達側からも消えます。

## 以前のスキーマを実行済みの場合
`supabase/schema.sql` を**もう一度そのまま実行**してください。リアクション(複数の絵文字)、プロフィール写真、自己紹介に対応するため、`reactions` テーブル(1人1リアクションの制約)と `profiles` テーブル(プロフィール写真と自己紹介)を更新します。既存の「いいね」は 👍 として残ります。

## 運用メモ
- Supabase 無料枠のプロジェクトは**約1週間アクセスが無いと一時停止**します。Dashboard から復元できます(データは消えません)。
- 保存した記録は、端末内とは別にサーバーにも保存されます(友達に共有するため)。端末内の記録はブラウザ内のみなので、Settings から定期的にバックアップしてください。
- 招待コードが漏れたら Friends タブの Regenerate で無効化できます。
- 機種変更時は、JSONバックアップ → 新端末でImport。共有済みの分は同じIDで上書きされます。

## 現時点の制限
- 複数端末での自動同期はありません(共有した分だけサーバーに上がります)。
- 通知(Push)はありません。フィードを開いて確認します。
- 別のアカウントでサインインし直すと、この端末にある記録が新しいアカウントで共有されます。端末とアカウントは1対1で使ってください。
