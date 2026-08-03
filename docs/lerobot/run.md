# 推論の実行

## 1. 推論前の安全確認

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

## 2. 推論動作テスト（録画なし）

LeRobot 0.6.0では、学習済みPolicyの実機実行に`lerobot-rollout`を使用します。`lerobot-record`へ`--device`や`--policy.path`を渡さないでください。


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
  --duration=60 \
  --task="Pick up the red cube" \
  --display_data=false \
  --play_sounds=true \
  --return_to_initial_position=true
```

`base`戦略ではデータを記録しないため、`--dataset.*`引数を追加しません。


## リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
