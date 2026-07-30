# キャリブレーション


## 1. キャリブレーション（Leader）

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

## 2. キャリブレーション（Follower）

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

## 3. テレオペレーション

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

## 4. リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
