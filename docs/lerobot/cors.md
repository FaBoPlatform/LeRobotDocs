# CORSの設定

## 1. rerunのダウングレード

```bash
python -m pip install --force-reinstall "rerun-sdk==0.32.2"
```

## 2. LeRobotのスクリプト場所を取得

```bash
VIZ_FILE="$(python - <<'PY'
import importlib.util

spec = importlib.util.find_spec(
    "lerobot.scripts.lerobot_dataset_viz"
)

if spec is None or spec.origin is None:
    raise SystemExit("lerobot_dataset_viz.py が見つかりません")

print(spec.origin)
PY
)"

echo "$VIZ_FILE"
```

## 3. バックアップ

```bash
cp -a \
  "$VIZ_FILE" \
  "${VIZ_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
```

## 4.　CORSの設定を追加

```bash
python - "$VIZ_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

old = "server_uri = rr.serve_grpc(grpc_port=grpc_port)"

new = '''server_uri = rr.serve_grpc(
            grpc_port=grpc_port,
            cors_allow_origin=[
                f"http://192.168.55.1:{web_port if web_port is not None else DEFAULT_RERUN_PORT}"
            ],
        )'''

if old in text:
    path.write_text(
        text.replace(old, new, 1),
        encoding="utf-8",
    )
    print(f"Patched: {path}")
elif "cors_allow_origin" in text:
    print(f"Already patched: {path}")
else:
    raise SystemExit(
        "修正対象のコードが見つかりませんでした。"
        "ファイル内容を確認してください。"
    )
PY
```
