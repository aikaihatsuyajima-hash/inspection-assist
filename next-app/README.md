# 検品アシスト Next.js版

Node.js 24.19.0、Next.js 16 App Router、TypeScriptで構成した新版。Cloud Runの`PORT`（既定8080）でstandalone serverを起動し、IAP JWTを本番の認証境界とする。FirestoreはサーバーのRoute Handlerだけがアクセスする。

## 開発

```powershell
pnpm install --frozen-lockfile --ignore-scripts
$env:DEV_AUTH_BYPASS="true" # ローカルのみ。本番NODE_ENVでは無効
$env:DATA_BACKEND="memory" # ローカル確認用。本番では無効（Firestoreを使用）
pnpm dev
```

`pnpm-lock.yaml`を正本とする。Node.js 24.19.0とpnpm 11.19.0でlockfile生成・依存解決を確認済み。Dockerはcorepack経由でpnpmを使う。

`DEV_AUTH_BYPASS=true`と`DATA_BACKEND=memory`は、認証・Firestoreを使えない開発/テスト時だけ明示的に指定する安全弁です。`NODE_ENV=production`ではどちらも認証や正本ストレージの代替にならず、IAP JWTとFirestoreの設定不備をfail closedします。

## 品質ゲート

`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。Firestore/IAPを含む統合試験はGCPまたはFirestore emulatorとテスト用IAP JWTを用意して実行すること。

## データ移行

旧版と同一originで旧キー`inspection-assist-state-v5`をJSON出力し、管理者が`/import/preview`→`/import/apply`を実行する。rollback用runを残し、移行元スナップショットとして監査する。
