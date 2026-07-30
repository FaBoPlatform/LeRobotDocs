# LeRobot 0.6.0 各種コマンド（フォーム連動版）

このページは、SO-101のポート、作業フォルダ、データセット名を入力フォームから各コマンドへ自動反映し、キャリブレーション、テレオペレーション、データ収集、ACT学習、実機推論まで実行するためのコマンド集です。

!!! warning
    キャリブレーション、データ収集、学習、推論では、同じ`robot.id`、`teleop.id`、カメラ名、データセットを一貫して使用してください。学習時のタスクと異なる物体・指示を、最初の推論テストで使用しないでください。

## 0. LeRobot環境の確認

Jetsonでは通常、インストーラーによって`lerobot` Conda環境が自動的に有効になります。有効になっていない場合は次を実行します。

```bash
if [ -f "$HOME/miniconda/etc/profile.d/conda.sh" ]; then
  source "$HOME/miniconda/etc/profile.d/conda.sh"
elif [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
  source "$HOME/miniconda3/etc/profile.d/conda.sh"
fi

conda activate lerobot
```

LeRobotと主要コマンドを確認します。

```bash
python - <<'PY'
from importlib.metadata import version
import sys

print("Python:", sys.version.split()[0])
print("LeRobot:", version("lerobot"))
PY

for command in \
  lerobot-find-port \
  lerobot-find-cameras \
  lerobot-calibrate \
  lerobot-teleoperate \
  lerobot-record \
  lerobot-train \
  lerobot-rollout
do
  command -v "$command" >/dev/null 2>&1 \
    && printf 'OK      %s\n' "$command" \
    || printf 'MISSING %s\n' "$command"
done
```

`LeRobot: 0.6.0`と表示され、使用するコマンドがすべて`OK`になることを確認します。

## 1. SO-101のポート確認

=== "Jetson"

    SO-101は通常、`/dev/ttyACM0`、`/dev/ttyACM1`、`/dev/ttyUSB0`などで認識されます。

    ```bash
    ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || true
    lerobot-find-port
    ```

    #### `Permission denied`が出る場合

    インストーラーで設定済みですが、`jetson`ユーザーが`dialout`グループに入っていない場合は次を実行します。

    ```bash
    sudo usermod -aG dialout jetson
    id jetson
    ```

    グループ変更は、現在のログインセッションには直ちに反映されません。収録や学習を実行していないことを確認してから再起動します。

    ```bash
    sudo reboot
    ```

    再起動後に確認します。

    ```bash
    id
    ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || true
    ```

    `id`の出力に`dialout`が含まれていることを確認してください。

=== "MacBook"

    ```bash
    ls -l /dev/tty.usbmodem* /dev/tty.usbserial* 2>/dev/null || true
    lerobot-find-port
    ```

## 2. カメラ確認

OpenCVで使用可能なカメラを探します。

```bash
lerobot-find-cameras opencv
```

Jetsonで`/dev/video0`を使用する場合は、640×480、MJPG、30fpsに対応しているか確認します。

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
v4l2-ctl -d /dev/video0 --get-fmt-video
v4l2-ctl -d /dev/video0 --get-parm
```

!!! note
    以下のJetson用コマンドは`/dev/video0`、640×480、MJPG、30fpsを前提にしています。別のカメラを使用する場合は、`index_or_path`、`width`、`height`、`fps`、`fourcc`を検出結果に合わせて変更してください。

## 3. フォームへ設定を入力

Leader、Follower、作業フォルダ、データセットの所有者と名前を入力します。

- `workspace dir`にはプロジェクトフォルダそのものを入力します。Jetsonの標準値は`/home/jetson/lerobot`です。
- `dataset.repo_id`は`user/repo`に分けて入力します。ローカルだけで使う例は`local / 1cam_test_headless`です。
- 「Hugging Faceにアップ」は各`--dataset.push_to_hub`へ反映されます。
- 「wandbにアップ」は各`--wandb.enable`へ反映されます。
- Hubへアップロードする場合は、`local`ではなく実際のHugging Faceユーザー名を入力し、事前に`hf auth login`を実行してください。

### フォーム初期値兼デフォルト検出用ブロック

次のブロックは**実行しません**。`lerobot_ports.js`がフォームの初期値とモデル名の生成規則を読み取るために必要です。このブロックは、ポートや学習コマンドより前に置いたままにしてください。

```text
--teleop.port=/dev/ttyACM0
--robot.port=/dev/ttyACM1
--dataset.repo_id=local/1cam_test_headless
--dataset.root=/home/jetson/lerobot/local/1cam_test_headless
--dataset.push_to_hub=false
--wandb.enable=false
--policy.type=act
--output_dir=models/act_1cam_test_headless
--job_name=act_1cam_test_headless
```

<div data-lerobot-port-panel></div>

フォームを変更すると、以下のプレースホルダーがページ内で自動更新されます。

```text
{{TELEOP_PORT}}
{{ROBOT_PORT}}
{{WORKSPACE_DIR}}
{{PROJECT_DIR}}
{{DATASET_REPO_ID}}
{{DATASET_USER_ID}}
{{DATASET_SLUG}}
{{DATASET_DIR}}
{{TRAIN_RUN_NAME}}
{{TRAIN_OUTPUT_DIR}}
{{TRAIN_CONFIG_PATH}}
{{POLICY_PATH}}
{{WANDB_ENABLE}}
```

## 4. 作業フォルダの作成・移動

```bash
mkdir -p -- "{{WORKSPACE_DIR}}"
cd -- "{{WORKSPACE_DIR}}"
pwd
```

## 5. 使用するポートの最終確認

```bash
for port in "{{ROBOT_PORT}}" "{{TELEOP_PORT}}"; do
  if [ ! -e "$port" ]; then
    echo "ERROR: device not found: $port" >&2
    exit 1
  fi
  if [ ! -r "$port" ] || [ ! -w "$port" ]; then
    echo "ERROR: no read/write permission: $port" >&2
    ls -l "$port" >&2
    exit 1
  fi
  ls -l "$port"
done
```

## 6. キャリブレーション（Leader）

!!! info
    既存のキャリブレーションをやり直すか質問された場合は、`c`を入力します。

```bash
lerobot-calibrate \
  --teleop.type=so101_leader \
  --teleop.port={{TELEOP_PORT}} \
  --teleop.id=my_leader_arm
```

通常、キャリブレーション結果は次の場所に保存されます。

```text
~/.cache/huggingface/lerobot/calibration/teleoperators/so_leader/my_leader_arm.json
```

## 7. キャリブレーション（Follower）

!!! info
    既存のキャリブレーションをやり直すか質問された場合は、`c`を入力します。

```bash
lerobot-calibrate \
  --robot.type=so101_follower \
  --robot.port={{ROBOT_PORT}} \
  --robot.id=my_follower_arm
```

通常、キャリブレーション結果は次の場所に保存されます。

```text
~/.cache/huggingface/lerobot/calibration/robots/so_follower/my_follower_arm.json
```

## 8. テレオペレーション

```bash
lerobot-teleoperate \
  --robot.type=so101_follower \
  --robot.port={{ROBOT_PORT}} \
  --robot.id=my_follower_arm \
  --teleop.type=so101_leader \
  --teleop.port={{TELEOP_PORT}} \
  --teleop.id=my_leader_arm
```

FollowerがLeaderに追従することを確認し、`Ctrl+C`で終了します。

## 9. データセット収集（新規）

既存の同名データセットがあると新規作成に失敗します。削除対象が空文字やルートディレクトリでないことを確認してから削除します。

```bash
DATASET_TO_REMOVE="{{DATASET_DIR}}"

case "$DATASET_TO_REMOVE" in
  ""|"/"|".")
    echo "ERROR: unsafe dataset path: '$DATASET_TO_REMOVE'" >&2
    exit 1
    ;;
esac

rm -rf -- "$DATASET_TO_REMOVE"
echo "Ready: $DATASET_TO_REMOVE"
```

`dataset.episode_time_s`は1エピソードの収集時間、`dataset.reset_time_s`は次のエピソードまでのリセット時間、`dataset.num_episodes`は収集するエピソード数です。

=== "Jetson"

    SSH接続時は、Rerun GUIを起動しないように`--display_data=false`を使用します。

    ```bash
    cd -- "{{PROJECT_DIR}}"

    lerobot-record \
      --robot.type=so101_follower \
      --robot.port={{ROBOT_PORT}} \
      --robot.id=my_follower_arm \
      --teleop.type=so101_leader \
      --teleop.port={{TELEOP_PORT}} \
      --teleop.id=my_leader_arm \
      --robot.cameras="{front: {type: opencv, index_or_path: '/dev/video0', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.root={{DATASET_DIR}} \
      --dataset.push_to_hub=false \
      --dataset.single_task="Pick up the red cube" \
      --dataset.fps=30 \
      --dataset.episode_time_s=10 \
      --dataset.reset_time_s=5 \
      --dataset.num_episodes=30 \
      --dataset.streaming_encoding=false \
      --display_data=false \
      --play_sounds=true
    ```

    !!! note
        Jetsonのデスクトップ上のターミナルで実行し、`DISPLAY`または`WAYLAND_DISPLAY`が設定されている場合のみ、必要に応じて`--display_data=true`へ変更できます。SSHでは`false`のまま使用してください。

=== "MacBook"

    Macのカメラ番号が`0`の場合の例です。AVFoundationで`MJPG`が表示されないカメラもあるため、Mac用コマンドでは`fourcc`を固定していません。

    ```bash
    cd -- "{{PROJECT_DIR}}"

    lerobot-record \
      --robot.type=so101_follower \
      --robot.port={{ROBOT_PORT}} \
      --robot.id=my_follower_arm \
      --teleop.type=so101_leader \
      --teleop.port={{TELEOP_PORT}} \
      --teleop.id=my_leader_arm \
      --robot.cameras="{front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30}}" \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.root={{DATASET_DIR}} \
      --dataset.push_to_hub=false \
      --dataset.single_task="Pick up the red cube" \
      --dataset.fps=30 \
      --dataset.episode_time_s=10 \
      --dataset.reset_time_s=5 \
      --dataset.num_episodes=30 \
      --dataset.streaming_encoding=false \
      --display_data=true
    ```

    H.264を明示する場合、LeRobot 0.6.0では旧引数`--dataset.vcodec=h264`ではなく、次を追加します。

    ```bash
    --dataset.rgb_encoder.vcodec=h264
    ```

## 10. 収集データセットの完成確認

録画を最後まで完了させ、終了ログが表示された後に確認します。強制終了や`kill -9`は避けてください。

```bash
python - "{{DATASET_DIR}}" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).expanduser().resolve()
required = (
    root / "meta" / "info.json",
    root / "meta" / "stats.json",
    root / "meta" / "tasks.parquet",
)

missing = [path for path in required if not path.is_file()]
if missing:
    print("ERROR: dataset is incomplete:", file=sys.stderr)
    for path in missing:
        print(f"  MISSING {path}", file=sys.stderr)
    raise SystemExit(1)

info = json.loads((root / "meta" / "info.json").read_text())
episode_files = sorted((root / "meta" / "episodes").rglob("*.parquet"))
data_files = sorted((root / "data").rglob("*.parquet"))
video_files = sorted((root / "videos").rglob("*.mp4"))

if not episode_files:
    raise SystemExit("ERROR: no episode metadata parquet found")
if not data_files:
    raise SystemExit("ERROR: no action/state parquet found")
if not video_files:
    raise SystemExit("ERROR: no MP4 video found")
if info.get("total_episodes", 0) <= 0:
    raise SystemExit("ERROR: total_episodes is zero")
if info.get("total_frames", 0) <= 0:
    raise SystemExit("ERROR: total_frames is zero")

print("Dataset:", root)
print("total_episodes:", info.get("total_episodes"))
print("total_frames:", info.get("total_frames"))
print("total_tasks:", info.get("total_tasks"))
print("episode metadata files:", len(episode_files))
print("action/state data files:", len(data_files))
print("video files:", len(video_files))
print("Dataset validation: OK")
PY
```

!!! warning
    学習時の`--dataset.root`と`--dataset.repo_id`には、ここで確認した完成済みデータセットと同じ値を使用してください。以前の途中データセットと、新しく完成したデータセットを取り違えないでください。

## 11. データセット収集（追加）

既存データセットへ追加するときは、初回収集時と同じ`repo_id`、`root`、カメラ構成、FPS、タスク名を使用し、`--resume=true`を指定します。次の例では5エピソードを追加します。

```bash
cd -- "{{PROJECT_DIR}}"

lerobot-record \
  --robot.type=so101_follower \
  --robot.port={{ROBOT_PORT}} \
  --robot.id=my_follower_arm \
  --teleop.type=so101_leader \
  --teleop.port={{TELEOP_PORT}} \
  --teleop.id=my_leader_arm \
  --robot.cameras="{front: {type: opencv, index_or_path: '/dev/video0', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
  --dataset.repo_id={{DATASET_REPO_ID}} \
  --dataset.root={{DATASET_DIR}} \
  --dataset.push_to_hub=false \
  --dataset.single_task="Pick up the red cube" \
  --dataset.fps=30 \
  --dataset.episode_time_s=10 \
  --dataset.reset_time_s=5 \
  --dataset.num_episodes=5 \
  --dataset.streaming_encoding=false \
  --display_data=false \
  --play_sounds=true \
  --resume=true
```

追加収集後、「収集データセットの完成確認」をもう一度実行します。

## 12. ACT学習前の確認

### Jetson：CUDAの確認

```bash
python - <<'PY'
import torch

print("PyTorch:", torch.__version__)
print("CUDA build:", torch.version.cuda)
print("CUDA available:", torch.cuda.is_available())
if not torch.cuda.is_available():
    raise SystemExit("ERROR: PyTorch CUDA is unavailable")
print("GPU:", torch.cuda.get_device_name(0))
PY
```

### Jetson：ResNet18学習済み重みの確認と取得

インストーラーで次のファイルが配置済みであることを確認します。

```bash
set -euo pipefail

RESNET_DIR=/home/jetson/.cache/torch/hub/checkpoints
RESNET_FILE="$RESNET_DIR/resnet18-f37072fd.pth"
RESNET_TMP="$RESNET_FILE.part"
RESNET_URL=https://download.pytorch.org/models/resnet18-f37072fd.pth

verify_resnet18() {
  [ -s "$1" ] || return 1

  local checksum
  checksum="$(sha256sum "$1" | awk '{print $1}')"
  case "$checksum" in
    f37072fd*)
      printf 'ResNet18 SHA256: OK (%s)\n' "$checksum"
      ;;
    *)
      printf 'ERROR: unexpected ResNet18 SHA256: %s\n' "$checksum" >&2
      return 1
      ;;
  esac
}

mkdir -p "$RESNET_DIR"

if ! verify_resnet18 "$RESNET_FILE"; then
  echo "ResNet18 is missing or invalid. Downloading it again."
  rm -f "$RESNET_FILE" "$RESNET_TMP"

  curl -fL \
    --retry 5 \
    --retry-delay 2 \
    "$RESNET_URL" \
    -o "$RESNET_TMP"

  verify_resnet18 "$RESNET_TMP"
  mv "$RESNET_TMP" "$RESNET_FILE"
  chmod 644 "$RESNET_FILE"
fi

ls -lh /home/jetson/.cache/torch/hub/checkpoints/
```

ネットワークがない状態でファイルが存在しない場合は、別のPCで`resnet18-f37072fd.pth`を取得し、同じキャッシュディレクトリへコピーしてください。

TorchVisionから読み込めるか確認します。

```bash
python - <<'PY'
from torchvision.models import ResNet18_Weights, resnet18

model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
print("ResNet18 pretrained weights: OK")
print("Parameters:", sum(parameter.numel() for parameter in model.parameters()))
PY
```

### 新規学習の出力先確認

LeRobot 0.6.0は、`--resume=false`の状態で既存の`output_dir`を指定すると停止します。既存結果を消さず、日時付きの名前へ退避します。

```bash
cd -- "{{PROJECT_DIR}}"
TRAIN_DIR="{{TRAIN_OUTPUT_DIR}}"

case "$TRAIN_DIR" in
  ""|"/"|".")
    echo "ERROR: unsafe training output path: '$TRAIN_DIR'" >&2
    exit 1
    ;;
esac

if [ -e "$TRAIN_DIR" ]; then
  BACKUP_DIR="${TRAIN_DIR}.bak.$(date +%Y%m%d-%H%M%S)"
  mv -- "$TRAIN_DIR" "$BACKUP_DIR"
  echo "Existing training output moved to: $BACKUP_DIR"
fi

mkdir -p -- "$(dirname "$TRAIN_DIR")"
```

## 13. ACT学習（新規）

5000ステップで動作を確認し、必要に応じて1万〜2万ステップへ増やします。フォームの「Hugging Faceにアップ」はデータセット用です。モデルのHubアップロードは、`policy.repo_id`未指定エラーを避けるため、この例では無効にしています。

=== "Jetson"

    完成済みのローカルデータセットとキャッシュ済みResNet18を使用する例です。

    ```bash
    cd -- "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1
    export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True,max_split_size_mb:128

    lerobot-train \
      --dataset.root={{DATASET_DIR}} \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.video_backend=pyav \
      --policy.type=act \
      --output_dir={{TRAIN_OUTPUT_DIR}} \
      --job_name={{TRAIN_RUN_NAME}} \
      --policy.device=cuda \
      --policy.push_to_hub=false \
      --save_checkpoint_to_hub=false \
      --wandb.enable={{WANDB_ENABLE}} \
      --steps=15000 \
      --save_freq=5000 \
      --batch_size=2 \
      --num_workers=0 \
      --policy.use_amp=true \
      --policy.use_vae=false \
      --policy.chunk_size=50 \
      --policy.n_action_steps=50
    ```

    正常終了時は、最後に概ね次が表示されます。

    ```text
    Checkpoint policy after step 5000
    End of training
    ```

    |STEP数|Dataset|Jetson Orin Nano(学習時間)|
    |:--|:--|:--|
    |5000|10秒x30episode|30分|
    |10000|10秒x30episode|50分|
    |15000|10秒x30episode|1時間10分|

=== "MacBook"

    ```bash
    cd -- "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1

    lerobot-train \
      --dataset.root={{DATASET_DIR}} \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.video_backend=pyav \
      --policy.type=act \
      --output_dir={{TRAIN_OUTPUT_DIR}} \
      --job_name={{TRAIN_RUN_NAME}} \
      --policy.device=mps \
      --policy.push_to_hub=false \
      --save_checkpoint_to_hub=false \
      --wandb.enable={{WANDB_ENABLE}} \
      --steps=15000 \
      --save_freq=5000 \
      --batch_size=2 \
      --num_workers=0 \
      --policy.use_vae=false \
      --policy.chunk_size=50 \
      --policy.n_action_steps=50
    ```

    !!! note
        `'torchcodec' is not available ... falling back to 'pyav'`は、PyAVへ切り替えたことを示す警告です。`--dataset.video_backend=pyav`を明示しているため、学習を停止する致命的エラーではありません。

## 14. チェックポイント確認

```bash
cd -- "{{PROJECT_DIR}}"
POLICY_DIR="{{POLICY_PATH}}"

if [ ! -f "$POLICY_DIR/config.json" ]; then
  echo "ERROR: config.json not found: $POLICY_DIR" >&2
  exit 1
fi
if [ ! -f "$POLICY_DIR/train_config.json" ]; then
  echo "ERROR: train_config.json not found: $POLICY_DIR" >&2
  exit 1
fi
if ! find "$POLICY_DIR" -maxdepth 1 -type f -name '*.safetensors' -print -quit | grep -q .; then
  echo "ERROR: safetensors model not found: $POLICY_DIR" >&2
  exit 1
fi

ls -lah "$POLICY_DIR"
echo "Policy path: $POLICY_DIR"
```

## 15. 学習の継続

`steps`は追加ステップ数ではなく、継続後に到達させる総ステップ数です。5000ステップから15000ステップまで継続する例です。JSONを手作業で編集せず、CLIで`--steps=15000`を上書きします。

```bash
cd -- "{{PROJECT_DIR}}"
export HF_HUB_OFFLINE=1

TRAIN_CONFIG_PATH="{{TRAIN_CONFIG_PATH}}"

if [ ! -f "$TRAIN_CONFIG_PATH" ]; then
  echo "ERROR: train_config.json not found: $TRAIN_CONFIG_PATH" >&2
  exit 1
fi

lerobot-train \
  --config_path={{TRAIN_CONFIG_PATH}} \
  --resume=true \
  --steps=15000 \
  --policy.push_to_hub=false \
  --save_checkpoint_to_hub=false \
  --wandb.enable={{WANDB_ENABLE}}
```

## 16. 推論前の安全確認

- ロボットの周囲から障害物を取り除きます。
- いつでも`Ctrl+C`で停止できる状態にします。
- カメラ位置、照明、物体、背景、ロボット初期姿勢を学習時に合わせます。
- 学習タスクが`Pick up the red cube`なら、最初の推論でも同じタスク文と赤いキューブを使用します。
- 最初は10秒だけ、録画なしで確認します。

Policyを検査します。

```bash
cd -- "{{PROJECT_DIR}}"
POLICY_PATH="{{POLICY_PATH}}"

if [ ! -f "$POLICY_PATH/config.json" ]; then
  echo "ERROR: invalid policy path: $POLICY_PATH" >&2
  exit 1
fi
if ! find "$POLICY_PATH" -maxdepth 1 -type f -name '*.safetensors' -print -quit | grep -q .; then
  echo "ERROR: model file not found: $POLICY_PATH" >&2
  exit 1
fi

ls -lah "$POLICY_PATH"
```

## 17. 推論動作テスト（録画なし）

LeRobot 0.6.0では、学習済みPolicyの実機実行に`lerobot-rollout`を使用します。`lerobot-record`へ`--device`や`--policy.path`を渡さないでください。

=== "Jetson"

    ```bash
    cd -- "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1

    lerobot-rollout \
      --strategy.type=base \
      --policy.path={{POLICY_PATH}} \
      --robot.type=so101_follower \
      --robot.port={{ROBOT_PORT}} \
      --robot.id=my_follower_arm \
      --robot.cameras="{front: {type: opencv, index_or_path: '/dev/video0', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
      --device=cuda \
      --fps=30 \
      --duration=10 \
      --task="Pick up the red cube" \
      --display_data=false \
      --play_sounds=true \
      --return_to_initial_position=true
    ```

    `base`戦略ではデータを記録しないため、`--dataset.*`引数を追加しません。

=== "MacBook"

    ```bash
    cd -- "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1

    lerobot-rollout \
      --strategy.type=base \
      --policy.path={{POLICY_PATH}} \
      --robot.type=so101_follower \
      --robot.port={{ROBOT_PORT}} \
      --robot.id=my_follower_arm \
      --robot.cameras="{front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30}}" \
      --device=mps \
      --fps=30 \
      --duration=10 \
      --task="Pick up the red cube" \
      --display_data=true \
      --return_to_initial_position=true
    ```

## 18. 推論評価データ収集（Episodic Rollout）

LeRobot 0.6.0のPolicy Rollout用データセット名は、`rollout_`で始める必要があります。この文書では、フォームの所有者とデータセット名から次を自動生成します。

```text
repo_id: {{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}
root:    {{PROJECT_DIR}}/{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}
```

!!! note
    現在の`lerobot_ports.js`は`EVAL_DATASET_*`を`eval_`形式で生成するため、この節ではそれらを使わず、`DATASET_USER_ID`、`DATASET_SLUG`、`PROJECT_DIR`から`rollout_`形式を組み立てます。

既存の評価データセットがある場合は、削除せず日時付きの名前へ退避します。

```bash
ROLLOUT_REPO_ID="{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}"
ROLLOUT_DIR="{{PROJECT_DIR}}/{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}"

case "$ROLLOUT_DIR" in
  ""|"/"|".")
    echo "ERROR: unsafe rollout dataset path: '$ROLLOUT_DIR'" >&2
    exit 1
    ;;
esac

if [ -e "$ROLLOUT_DIR" ]; then
  ROLLOUT_BACKUP="${ROLLOUT_DIR}.bak.$(date +%Y%m%d-%H%M%S)"
  mv -- "$ROLLOUT_DIR" "$ROLLOUT_BACKUP"
  echo "Existing rollout dataset moved to: $ROLLOUT_BACKUP"
fi

printf 'Rollout repo_id: %s\n' "$ROLLOUT_REPO_ID"
printf 'Rollout root:    %s\n' "$ROLLOUT_DIR"
```

最初は3エピソード、1エピソード10秒で確認します。Leaderを接続すると、エピソード間のリセット時間中にLeaderでFollowerを操作できます。

`lerobot_ports.js`による通常データセットへの再置換を避けるため、Rollout用の`dataset.repo_id`と`dataset.root`はオプション名をシェル変数で渡しています。

フォームの「Hugging Faceにアップ」を有効にした場合にも対応できるよう、このRollout収集ブロックでは`HF_HUB_OFFLINE=1`を固定しません。完全オフラインで実行する場合だけ、事前に`export HF_HUB_OFFLINE=1`を設定してください。

```bash
cd -- "{{PROJECT_DIR}}"

ROLLOUT_REPO_ID="{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}"
ROLLOUT_DIR="{{PROJECT_DIR}}/{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}"
DATASET_REPO_OPTION="--dataset.repo_id"
DATASET_ROOT_OPTION="--dataset.root"

lerobot-rollout \
  --strategy.type=episodic \
  --policy.path={{POLICY_PATH}} \
  --robot.type=so101_follower \
  --robot.port={{ROBOT_PORT}} \
  --robot.id=my_follower_arm \
  --robot.cameras="{front: {type: opencv, index_or_path: '/dev/video0', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
  --teleop.type=so101_leader \
  --teleop.port={{TELEOP_PORT}} \
  --teleop.id=my_leader_arm \
  --device=cuda \
  --fps=30 \
  --display_data=false \
  --play_sounds=true \
  --return_to_initial_position=true \
  --strategy.reset_to_initial_position=true \
  "${DATASET_REPO_OPTION}=${ROLLOUT_REPO_ID}" \
  "${DATASET_ROOT_OPTION}=${ROLLOUT_DIR}" \
  --dataset.single_task="Pick up the red cube" \
  --dataset.fps=30 \
  --dataset.episode_time_s=10 \
  --dataset.reset_time_s=15 \
  --dataset.num_episodes=3 \
  --dataset.streaming_encoding=false \
  --dataset.tags='["evaluation", "act"]' \
  --dataset.push_to_hub=false
```

評価終了後は、`ROLLOUT_DIR`を引数にして「収集データセットの完成確認」と同じ検査を実行します。

## 19. GUI表示に関するエラー

SSH接続中に次のエラーが出る場合、Rerun GUIを起動できるディスプレイ環境がありません。

```text
neither WAYLAND_DISPLAY nor WAYLAND_SOCKET nor DISPLAY is set
```

JetsonをSSHで操作する場合は、収集・推論コマンドを次の設定にします。

```bash
--display_data=false
```

`re_quota_channel`の`Sender has been blocked`警告が同時に出る場合も、まずRerun表示を無効化してください。

## 20. オフライン・オンライン切り替え

ローカルデータセット、ローカルPolicy、キャッシュ済みResNet18だけを使用する場合は次を設定します。

```bash
export HF_HUB_OFFLINE=1
```

HubへアップロードまたはHubからダウンロードする場合は、オフライン設定を解除してログインします。

```bash
unset HF_HUB_OFFLINE
hf auth login
```

!!! warning
    「Hugging Faceにアップ」を有効にした収集コマンドを実行する前に、同じターミナルで`unset HF_HUB_OFFLINE`を実行してください。

## 21. フォーム連動時の注意点

- フォーム初期値用ブロックを、最初の`--teleop.port`、`--robot.port`、`--dataset.repo_id`、`--output_dir`、`--job_name`より前に置きます。
- `workspace dir`には`/home/jetson`ではなく、`/home/jetson/lerobot`まで入力します。
- 通常データセットは`{{DATASET_REPO_ID}}`、Policy Rolloutデータセットは`{{DATASET_USER_ID}}/rollout_{{DATASET_SLUG}}`です。
- `{{TRAIN_OUTPUT_DIR}}`、`{{TRAIN_CONFIG_PATH}}`、`{{POLICY_PATH}}`は、フォームのデータセット名から自動生成されます。
- 新規収集と新規学習では既存フォルダを誤って上書きしないよう、削除または退避処理を先に実行します。

## 22. リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
