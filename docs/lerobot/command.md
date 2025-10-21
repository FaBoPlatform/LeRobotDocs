# LeRobot各種コマンド(新版)

2025/9/28現在のコマンド。

## USB認識

Jetsonの場合は

```
/dev/ttyACM0
/dev/ttyACM1
```

```
/dev/ttyUSB0
/dev/ttyUSB1
```

で認識

## フォルダ構成

```
src/lerobot
```

に移動されています。

## キャリブレーション(Leader)

SO101

```
lerobot-calibrate \
  --teleop.type=so101_leader \
  --teleop.port=/dev/ttyACM1 \
  --teleop.id=my_leader_arm
```

Koch ARM

```
python -m lerobot.calibrate \
  --teleop.type=koch_leader \
  --teleop.port=/dev/ttyUSB1 \
  --teleop.id=my_leader_arm
```

## キャリブレーション(Follower)

SO101

```
lerobot-calibrate \
  --robot.type=so101_leader \
  --robot.port=/dev/ttyACM0\
  --robot.id=my_follower_arm
```

Koch ARM

```
python -m lerobot.calibrate \
  --robot.type=koch_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_follower_arm
```

## Teleportation

```
lerobot-teleoperate   \
  --robot.type=so101_follower   \
  --robot.port=/dev/ttyACM1   \
  --robot.id=my_follower_arm   \
  --teleop.type=so101_leader   \
  --teleop.port=/dev/ttyACM0   \
  --teleop.id=my_leader_arm
```


## データセット収集

```
rm -rf /home/dev/lerobot_datasets
```

```
lerobot-record \
  --robot.type=so101_follower \
  --robot.port=/dev/ttyACM0 \
  --robot.id=my_follower_arm \
  --teleop.type=so101_leader \
  --teleop.port=/dev/ttyACM1 \
  --teleop.id=my_leader_arm \
  --dataset.repo_id=1can_test \
  --dataset.root=/home/jetson/lerobot/datasets/1can_test \
  --dataset.push_to_hub=false \
  --dataset.single_task="Pick up the red cube" \
  --robot.cameras="{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30}}" \
  --display_data=true \
  --dataset.episode_time_s=30 \
  --dataset.reset_time_s=10 \
  --dataset.num_episodes=30
```

## 学習

学習回数は、`lerobot/lerobot/configs/train.py`のsteps数で調整。初期値は10万stepsなので、Jetsonの場合、4000 stepsぐらいで試していく。


```
lerobot-train \
  dataset.path=/home/dev/lerobot_datasets/1can_test \
  policy=act \
  output_dir=outputs/train/act_1can_test \
  job_name=act_1can_test \
  policy.device=cuda \
  wandb.enable=false \
  policy.push_to_hub=false \
  training.steps=4000
```

## 推論実行

```
python lerobot/scripts/control_robot.py \
  --robot.type=so100 \
  --control.type=record \
  --control.fps=30 \
  --control.single_task="Grasp a lego block and put it in the bin." \
  --control.repo_id=$HF_USER/eval_act_so100_test \
  --control.tags='["tutorial"]' \
  --control.warmup_time_s=5 \
  --control.episode_time_s=30 \
  --control.reset_time_s=30 \
  --control.num_episodes=10 \
  --control.push_to_hub=true \
  --control.policy.path=outputs/train/act_so100_test/checkpoints/last/pretrained_model
```

## リファレンス

- [https://huggingface.co/docs/lerobot/so101](https://huggingface.co/docs/lerobot/so101)
