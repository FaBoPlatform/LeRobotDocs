# toio Command

M3 MacBookで、10000 stepsで2時間程度の学習時間です。

## Teleop

```shell 
lerobot-teleoperate \
    --robot.type=toio_follower \
    --teleop.type=toio_leader \
    --fps=60
```

## データセット収集

- `--dataset.root=/Users/username/Documents/workspace_lerobot/datasets/toio_test`のフォルダに保存する場合の指定。各自の環境に合わせて修正
- `--robot.cameras="{ front: {type: opencv, index_or_path: 1, width: 640, height: 480, fps: 30}}"` index_or_pathを1を指定するとMacBook使用ならiPhoneを呼び出せる。

```shell
lerobot-record \
  --robot.type=toio_follower \
  --teleop.type=toio_leader \
  --dataset.repo_id=local/toio_test \
  --dataset.root=/Users/username/Documents/workspace_lerobot/datasets/toio_test \
  --dataset.push_to_hub=false \
  --robot.cameras="{ front: {type: opencv, index_or_path: 1, width: 640, height: 480, fps: 30}}" \
  --display_data=true \
  --dataset.episode_time_s=10 \
  --dataset.reset_time_s=2 \
  --dataset.num_episodes=30
```

## 学習

- `--policy.device=mps`でMacBookのGPUで学習可能
- `--steps=10000` 10000 stepsの学習

```shell
lerobot-train \
  --dataset.root="/Users/username/Documents/workspace_leracer/datasets/toio_test" \
  --dataset.repo_id="local/toio_test" \
  --policy.type=act \
  --output_dir="outputs/train/act_1toio_test_mps" \
  --job_name="act_toio_test_mps" \
  --policy.device=mps \
  --wandb.enable=false \
  --policy.push_to_hub=false \
  --steps=10000
```

## 推論実行


```shell
lerobot-record \
  --robot.type=toio_follower \
  --dataset.repo_id=local/eval_toio_test \
  --dataset.root=/Users/username/Documents/workspace_leracer/datasets/eval_toio_test \
  --dataset.push_to_hub=false \
  --robot.cameras="{ front: {type: opencv, index_or_path: 1, width: 640, height: 480, fps: 30}}" \
  --policy.path="outputs/train/act_1toio_test_mps/checkpoints/last/pretrained_model/" \
  --display_data=true
```


## 質問等

- [FaBo Discord](https://discord.com/invite/StJ84Hb)