# データセットの収集


## 1. データセット収集（新規）

既存の同名データセットがあると新規作成に失敗します。削除対象が空文字やルートディレクトリでないことを確認してから削除します。

```bash
rm -rf "{{DATASET_DIR}}"
```

`dataset.episode_time_s`は1エピソードの収集時間、`dataset.reset_time_s`は次のエピソードまでのリセット時間、`dataset.num_episodes`は収集するエピソード数です。

=== "カメラ1個"

    SSH接続時は、Rerun GUIを起動しないように`--display_data=false`を使用します。

    ```bash
    cd "{{PROJECT_DIR}}"

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
      --dataset.num_episodes=1 \
      --dataset.streaming_encoding=false \
      --display_data=false \
      --play_sounds=true
    ```

    !!! note
        Jetsonのデスクトップ上のターミナルで実行し、`DISPLAY`または`WAYLAND_DISPLAY`が設定されている場合のみ、必要に応じて`--display_data=true`へ変更できます。SSHでは`false`のまま使用してください。

=== "カメラ2個"

    SSH接続時は、Rerun GUIを起動しないように`--display_data=false`を使用します。

    ```bash
    cd "{{PROJECT_DIR}}"

    lerobot-record \
      --robot.type=so101_follower \
      --robot.port={{ROBOT_PORT}} \
      --robot.id=my_follower_arm \
      --teleop.type=so101_leader \
      --teleop.port={{TELEOP_PORT}} \
      --teleop.id=my_leader_arm \
      --robot.cameras="{front: {type: opencv, index_or_path: '/dev/video0', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}, side:{type: opencv, index_or_path: '/dev/video2', backend: 200, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.root={{DATASET_DIR}} \
      --dataset.push_to_hub=false \
      --dataset.single_task="Pick up the red cube" \
      --dataset.fps=30 \
      --dataset.episode_time_s=10 \
      --dataset.reset_time_s=5 \
      --dataset.num_episodes=1 \
      --dataset.streaming_encoding=false \
      --display_data=false \
      --play_sounds=true
    ```

    !!! note
        Jetsonのデスクトップ上のターミナルで実行し、`DISPLAY`または`WAYLAND_DISPLAY`が設定されている場合のみ、必要に応じて`--display_data=true`へ変更できます。SSHでは`false`のまま使用してください。


## 2. データセット収集（追加）

1の操作で収集したデータセットをさらに追加したい場合に、下記コマンドで追加収集可能です。

既存データセットへ追加するときは、初回収集時と同じ`repo_id`、`root`、カメラ構成、FPS、タスク名を使用し、`--resume=true`を指定します。次の例では5エピソードを追加します。

```bash
cd　"{{PROJECT_DIR}}"

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

## リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
