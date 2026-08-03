# Bedrockの設定(PC側)

## AWS cli

AWS cliのVersionを確認

```bash
aws --version
```

```bash
aws-cli/2.36.14 Python/3.14.6 Linux/6.8.12-1021-tegra exe/aarch64.ubuntu.24
```

## AWS SSOの設定

```bssh
aws configure sso --profile my-pak-profile --use-device-code
```

SSOのstart URL, リージョンなどを設定します。

```bash
SSO session name (Recommended): lerobot
SSO start URL [None]: https://d-xxxxxxxxxx.awsapps.com/start
SSO region [None]: ap-northeast-1
SSO registration scopes [sso:account:access]:
```

URLが表示されるのと発行されたKeyを入力し設定します。

## BedrockのClaude Fable 5のprovider_data_shareの設定

AWSでCloud Shellを起動して、Fable5のprovider_data_shareの設定を有効化します。

```
aws bedrock put-account-data-retention --mode provider_data_share --region ap-northeast-1
```
## Claude Code Desktopを終了

Claude Code Desktopを完全に終了します(OSXならCMD+Q)。

各環境に合わせて`~/.claude/settings.json`を設定します。

`~/.claude/settings.json`　OSXでの例

```bash
{
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_PROFILE": "my-pak-profile",
    "AWS_REGION": "ap-northeast-1",
    "ANTHROPIC_MODEL": "global.anthropic.claude-fable-5"
  }
}
```

## Claude Code Desktopを再起動

再起動すると、`CLAUDE_CODE_USE_BEDROCK`が有効になり、Bedrockのfable5に接続可能になります。

## 他のモデルを使う場合

`ANTHROPIC_MODEL`の値を変更すると、他のモデルに切り替えられます。

| モデル | `ANTHROPIC_MODEL`の値 |
|---|---|
| Claude Fable 5 | `global.anthropic.claude-fable-5` |
| Claude Opus 5 | `global.anthropic.claude-opus-5` |
| Claude Sonnet 5 | `global.anthropic.claude-sonnet-5` |
| Claude Opus 4.8（日本国内リージョンで処理） | `jp.anthropic.claude-opus-4-8` |

例えばOpus 5に切り替える場合、`~/.claude/settings.json`を次のように書き換えます。

```bash
{
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_PROFILE": "my-pak-profile",
    "AWS_REGION": "ap-northeast-1",
    "ANTHROPIC_MODEL": "global.anthropic.claude-opus-5"
  }
}
```

書き換え後、Claude Code Desktopを再起動すると反映されます。

利用可能なモデルIDの一覧は、次のコマンドで確認できます。

```bash
aws bedrock list-inference-profiles \
  --profile my-pak-profile \
  --region ap-northeast-1 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'claude')].[inferenceProfileId,status]" \
  --output table
```