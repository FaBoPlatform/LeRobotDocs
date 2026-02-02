# LeRobot各種コマンド

## 各種認識

Jetsonの場合はSO-101は、/dev/ttyUSB0や/dev/ttyACM0で認識、MacBookは、/dev/tty.usbmodem58FA1026181などで認識

Jetson

```
ls /dev/tty*
```

MacBook

```
ls /dev/tty.*
```

SO-101の接続先を確認できたら、次に、OpenCVに対応したカメラデバイスを探します。

```
lerobot-find-cameras opencv
```

```
--- Detected Cameras ---
Camera #0:
  Name: OpenCV Camera @ 0
  Type: OpenCV
  Id: 0
  Backend api: AVFOUNDATION
  Default stream profile:
    Format: 16.0
    Fourcc: 
    Width: 1920
    Height: 1080
    Fps: 24.000038
--------------------
Camera #1:
  Name: OpenCV Camera @ 1
  Type: OpenCV
  Id: 1
  Backend api: AVFOUNDATION
  Default stream profile:
    Format: 16.0
    Fourcc: 
    Width: 1920
    Height: 1080
    Fps: 15.0
--------------------
```

ここでは使用するカメラのIdをメモしておきます。

## コマンドの作成

全項目で判明したSO-101のデバイス名と、使用するカメラ IDを下記フォームに入力します。

<div data-lerobot-port-panel></div>


## 作業フォルダに移動

```
cd /Users/akira/Documents/workspace_lerobot/datasets
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

キャリブレーション結果は、`~/.cache/huggingface/lerobot/calibration/teleoperators/so_leader/my_leader_arm.json`に保存されます。

## キャリブレーション(Follower)

SO101

```
lerobot-calibrate \
  --robot.type=so101_follower \
  --robot.port=/dev/ttyACM0 \
  --robot.id=my_follower_arm
```

キャリブレーション結果は、`~/.cache/huggingface/lerobot/calibration/robots/so_follower/my_follower_arm.json`に保存されます。

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


## データセット収集(新規)

!!!Info
    データセットを新規で収集する場合に、すでに同じ名前のデータセットが存在しているとエラーが出ますので、先にフォルダ毎削除します。

```
rm -rf /Users/akira/Documents/workspace_lerobot/datasets/akira/1cam_test
```

```
lerobot-record \
    --robot.type=so101_follower \
    --robot.port=/dev/tty.usbmodem58FA1026181 \
    --robot.id=my_follower_arm \
    --teleop.type=so101_leader \
    --teleop.port=/dev/tty.usbmodem58FA1026371 \
    --teleop.id=my_leader_arm \
    --dataset.repo_id=akira/1cam_test \
    --dataset.root=/Users/akira/Documents/workspace_lerobot/datasets \
    --dataset.push_to_hub=false \
    --dataset.single_task="Pick up the red cube" \
    --robot.cameras="{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
    --dataset.vcodec=h264 \
    --display_data=true \
    --dataset.episode_time_s=10 \
    --dataset.reset_time_s=5 \
    --dataset.num_episodes=30
```

## データセット収集(追加)


!!!Info
    --resume=trueを指定する事で、既存データセットに追加でデータセットを追加可能です。

```
lerobot-record \
    --robot.type=so101_follower \
    --robot.port=/dev/tty.usbmodem58FA1026181 \
    --robot.id=my_follower_arm \
    --teleop.type=so101_leader \
    --teleop.port=/dev/tty.usbmodem58FA1026371 \
    --teleop.id=my_leader_arm \
    --dataset.repo_id=akira/1cam_test \
    --dataset.root=/Users/akira/Documents/workspace_lerobot/datasets \
    --dataset.push_to_hub=false \
    --dataset.single_task="Pick up the red cube" \
    --robot.cameras="{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
    --dataset.vcodec=h264 \
    --display_data=true \
    --dataset.episode_time_s=10 \
    --dataset.reset_time_s=5 \
    --dataset.num_episodes=5 \
    --resume=true
```

## 学習(新規)


!!!info
    環境にffmpegが入っていない場合は、`conda install -c conda-forge ffmpeg=7.1.1`でインストールしてください。


学習回数は、`lerobot/lerobot/configs/train.py`のsteps数で調整。Jetsonの場合、4000 stepsぐらいで試していくといいでしょう。1万〜2万Stepsぐらいを目安に調整していきます。

```
lerobot-train \                          
  --dataset.root=/Users/akira/Documents/workspace_lerobot/datasets \
  --dataset.repo_id=akira/1cam_test \
  --policy.type=act \
  --output_dir=outputs/train/act_1cam_test \
  --job_name=act_1cam_test \
  --policy.device=mps \
  --wandb.enable=false \
  --policy.push_to_hub=false \
  --steps=100000
```

目安の学習時間


|デバイス|GPU|学習時間|
|:--|:--|:--|
|M4 Mac| mps | 3時間 |


## 学習(継続)

`outputs/train/act_1cam_test/checkpoints/last/pretrained_model/train_config.json`

のstepsの項目に、学習(新規)で指定したstepsが記載されているので、その部分を修正し再学習します。

```json
    #"steps": 10000,
    "steps": 15000,
```

```
lerobot-train \
  --config_path outputs/train/act_1cam_test/checkpoints/last/pretrained_model/train_config.json \
  --resume=true
```

## 推論実行

```
rm -rf /Users/akira/Documents/workspace_lerobot/datasets/akira/eval_1cam_test
```

```
lerobot-record \
  --robot.type=so101_follower \
  --robot.port=/dev/tty.usbmodem58FA1026181 \
  --robot.id=my_follower_arm \
  --robot.cameras="{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30, fourcc: 'MJPG'}}" \
  --display_data=true \
  --dataset.root=/Users/akira/Documents/workspace_lerobot/datasets \
  --dataset.repo_id=akira/eval_1cam_test \
  --dataset.single_task="Grasp a lego block and put it in the bin." \
  --dataset.fps=30 \
  --dataset.episode_time_s=30 \
  --dataset.reset_time_s=30 \
  --dataset.num_episodes=10 \
  --dataset.tags='["tutorial"]' \
  --dataset.push_to_hub=false \
  --policy.path=outputs/train/act_1cam_test/checkpoints/last/pretrained_model
```

## リファレンス

- [https://huggingface.co/docs/lerobot/so101](https://huggingface.co/docs/lerobot/so101)
