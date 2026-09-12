# 実運用アーキテクチャ

ブラウザはNext.js UIとIndexedDB FIFO outboxを持ち、Firestoreへ直接接続しない。Route HandlerがIAP JWTを検証して倉庫メンバー権限を確認し、Firestore transactionでコンテナと`inspectionEvents/{idempotencyKey}`を同時更新する。同じキー・同じpayloadは保存済み結果を返し、異なるpayloadは409とする。

`operator`はscan/adjust、`manager`はimport、`admin`は全操作を許可する。品違いはHTTP業務成功のイベントとして記録し、過剰・未同期・数量不一致のcompleteは422で拒否する。旧localStorageはJSON snapshotとしてpreview/apply/rollbackし、存在しない監査履歴を捏造しない。
