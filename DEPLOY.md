# CosmicWatch アプリケーション デプロイ手順

## 概要
このアプリケーションは、React（フロントエンド）とNode.js/Express（バックエンド）を組み合わせたWebアプリケーションです。

## 事前準備

### 必要なもの
- Node.js 18以上
- pnpm（推奨）またはnpm
- レンタルサーバー（Node.js対応）

### 推奨レンタルサーバー
- Heroku
- Railway
- Render
- Vercel（serverless functions）
- VPS（さくらVPS、ConoHa VPS等）

## デプロイ手順

### 1. ローカルでビルド
```bash
# 依存関係をインストール
pnpm install

# プロダクションビルド
pnpm build

# ビルドされたファイルを確認
ls dist/
```

### 2. サーバーファイルの準備
アップロードするファイル：
- `server.js`
- `package.json`
- `dist/`フォルダ（ビルド済みフロントエンド）
- `node_modules/`（または本番環境でインストール）

### 3. 環境変数の設定
レンタルサーバーで以下の環境変数を設定：
```
PORT=3001
NODE_ENV=production
```

### 4. レンタルサーバーでの実行

#### A. Herokuの場合
```bash
# Heroku CLIでログイン
heroku login

# アプリケーション作成
heroku create cosmicwatch-app

# デプロイ
git push heroku main

# 環境変数設定
heroku config:set NODE_ENV=production
```

#### B. VPSの場合
```bash
# ファイルをアップロード
scp -r dist/ server.js package.json user@server:/path/to/app/

# サーバーにログイン
ssh user@server

# 依存関係インストール
cd /path/to/app
npm install --production

# PM2でアプリケーション起動
npm install -g pm2
pm2 start server.js --name cosmicwatch-app
pm2 save
pm2 startup
```

#### C. Railwayの場合
1. GitHubリポジトリを接続
2. 自動デプロイが開始される
3. 環境変数を設定

### 5. 起動確認
```bash
# ローカルで確認
pnpm deploy

# ブラウザでアクセス
http://localhost:3001
```

## 設定ファイルの詳細

### vite.config.ts
```typescript
const base = mode === "development" ? "/" : "/app/cosmicwatch-app/";
```
- 本番環境のベースパスを設定
- レンタルサーバーのディレクトリ構造に合わせて調整

### server.js
```javascript
const PORT = process.env.PORT || 3001;
```
- 環境変数PORTが設定されていない場合は3001番ポートを使用

## ディレクトリ構造
```
cosmicwatch-app/
├── dist/          # ビルド済みフロントエンド
├── data/          # 測定データ保存用（自動作成）
├── server.js      # バックエンドサーバー
├── package.json   # 依存関係
└── node_modules/  # Node.jsパッケージ
```

## トラブルシューティング

### ポート番号の問題
- レンタルサーバーが指定するポート番号を使用
- `process.env.PORT`で動的に設定

### ファイル権限の問題
```bash
chmod +x server.js
chmod -R 755 dist/
mkdir -p data
chmod 777 data/
```

### 依存関係のエラー
```bash
# node_modulesを削除して再インストール
rm -rf node_modules
npm install --production
```

## 運用コマンド

### アプリケーション起動
```bash
pnpm start
```

### アプリケーション停止
```bash
pm2 stop cosmicwatch-app
```

### ログ確認
```bash
pm2 logs cosmicwatch-app
```

### アプリケーション再起動
```bash
pm2 restart cosmicwatch-app
```

## セキュリティ設定

### CORS設定
- `server.js`でCORS設定済み
- 必要に応じて特定のドメインのみ許可

### HTTPS設定
- レンタルサーバーの機能を使用
- Let's Encrypt等でSSL証明書を取得

## 注意事項

1. **データ保存**：`data/`ディレクトリに測定データが保存されます
2. **メモリ使用量**：長時間運用時はメモリ使用量を監視
3. **バックアップ**：定期的にdataディレクトリをバックアップ
4. **ログ監視**：エラーログを定期的に確認