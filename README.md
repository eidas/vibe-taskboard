# タスク管理ボード Taskaru

個人用タスク管理・習慣トラッカーアプリ。

## セットアップ

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `supabase/migrations/001_init.sql` の内容を Supabase の SQL Editor で実行
3. **Authentication > Settings** で以下を設定:
   - JWT expiry: `2592000`（30日）
   - **Email** provider を有効化

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、値を設定:

```bash
cp .env.local.example .env.local
```

Supabase Dashboard > Settings > API から取得:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く。

## 機能

- **階層タスク管理**: レベル1〜5のネスト構造（レベル1 = プロジェクト）
- **インライン編集**: タスク名・期日・見積り時間をクリックまたは Enter/F2 で直接編集
- **期日タイプ**: なし/今日/今週/今月/今年/来年以降/特定の日付/繰り返し（毎日/毎週/毎月/毎年）
- **繰り返しタスク**: 期間が過ぎると完了が自動リセット
- **ドラッグ&ドロップ**: 行の並べ替え（子タスクごと移動）
- **レベル変更**: Tab（下げ）/ Shift+Tab（上げ）、または行を左右にドラッグ
- **完了の伝播**: 完了にすると子タスクも一緒に完了
- **フィルター**: すべて/完了/未完了
- **統計**: 今日のタスク・毎日のタスクの件数表示

## キーボードショートカット

### 行の操作

| キー | 動作 |
|------|------|
| `Ctrl` + `→` | タスクをインデント（レベルを1つ下げる） |
| `Ctrl` + `←` | タスクをアウトデント（レベルを1つ上げる） |

### チェックボックスにフォーカスがあるとき

| キー | 動作 |
|------|------|
| `Enter` / `Space` | 完了状態をトグル |
| `↑` / `↓` | 前後のタスクへ移動 |

### テキストセル（タスク名・メモ等）

| キー | 動作 |
|------|------|
| `Enter` / `F2` | 編集開始 |
| `↑` / `↓` | 前後のタスクへ移動（非編集時） |
| `Enter` | 編集を確定して終了（編集中） |
| `Escape` | 編集をキャンセル（編集中） |

> 空のセルにフォーカスが当たると自動的に編集モードになります。

### 期日セル

| キー | 動作 |
|------|------|
| `Enter` / `F2` | ドロップダウンを開く |
| `Enter` | 日付を確定（日付入力中） |
| `Escape` | ドロップダウンを閉じる |
| `↑` / `↓` | 前後のタスクへ移動 |

### 時間セル

| キー | 動作 |
|------|------|
| `Enter` / `F2` | 編集開始 |
| `Enter` | 編集を確定して終了（編集中） |
| `Escape` | 編集をキャンセル（編集中） |
| `↑` / `↓` | 前後のタスクへ移動（非編集時） |

### 詳細編集ダイアログ

| キー | 動作 |
|------|------|
| `Enter` | 保存して閉じる（メモ欄以外にフォーカスがある場合） |

### ドラッグ&ドロップをキーボードで操作

| キー | 動作 |
|------|------|
| `Space` / `Enter` | 行をつかむ／離す |
| `↑` / `↓` | つかんだ行を移動 |
| `Escape` | 移動をキャンセル |

---

## Vercel へのデプロイ

1. GitHub にリポジトリを push
2. Vercel でプロジェクトをインポート
3. 環境変数 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) を設定
4. Deploy

Supabase Dashboard > Authentication > URL Configuration で:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

を設定してください。
