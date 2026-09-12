# Terraform環境骨格

`main.tf`を各環境から参照し、`terraform.tfvars`へ実際のProject IDを設定する。prodではFirestore PITR、Cloud Schedulerによる日次/週次バックアップ、IAP OAuthブランドとIAMを組織の承認後に追加する。`REPLACE`イメージのままapplyしないこと。本リポジトリからGCPリソースの作成は行っていない。
