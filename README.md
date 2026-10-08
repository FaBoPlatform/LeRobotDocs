# LeRobotDocs

FaBo Physical Agent Kit のドキュメントです。MkDocs（Material for MkDocs）でビルドします。

## 開発環境

Dev container で、ビルドに必要なものがすべて揃います。

1. VS Code で本リポジトリを開き、「Reopen in Container」を実行する
2. 初回起動時に `requirements.txt` の依存が自動でインストールされる

CLI から使う場合は [Dev Containers CLI](https://github.com/devcontainers/cli) を使います。

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . mkdocs serve -a 0.0.0.0:8000
```

## プレビューとビルド

コンテナ内で実行します。

```bash
# プレビュー（http://localhost:8000、変更は自動で反映）
mkdocs serve -a 0.0.0.0:8000

# 静的サイトのビルド（出力先: site/）
mkdocs build
```

## 依存パッケージ

`requirements.txt` で固定しています。`mkdocs` は 1.x に固定しており、2.0 には上げないでください（`mkdocs-material` が MkDocs 2.0 を本番利用に不適と警告しているため）。
