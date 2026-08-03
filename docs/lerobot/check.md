# 接続の確認

## 1. 接続確認

接続先が下記の通りになっていることを確認してください。

![](./img/connection.png)

起動後にUSBを差し込むと認識番号が変わってしまうので、指定先にUSBを差し込み、Jetsonを再起動してください。

## 2. SO-101のポート確認

=== "Jetson"

    SO-101は通常、`/dev/ttyACM0`、`/dev/ttyACM1`、`/dev/ttyUSB0`などで認識されます。

    ```bash
    ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || true
    lerobot-find-port
    ```

=== "MacBook"

    ```bash
    ls -l /dev/tty.usbmodem* /dev/tty.usbserial* 2>/dev/null || true
    lerobot-find-port
    ```

## 3. カメラ確認

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


## リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
