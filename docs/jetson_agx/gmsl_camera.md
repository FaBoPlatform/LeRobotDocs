# GMSL

## G300用のDriverのインストール

```
cd gmsl-driver-orin-v1.0.20
```

```
chmod 755 *.sh
```

```
./copy_to_target.sh
./copy_to_target_xc.sh 
./copy_to_target_pwm.sh
./copy_to_target_cti.sh
./copy_to_target_leopard.sh
./copy_to_target_nomtd.sh
./copy_to_target_nomtd_xc.sh
```

```
sudo reboot
```

## 認識の確認

```
ls /dev/video*
```

```
/dev/video0  /dev/video2  /dev/video4  /dev/video6
/dev/video1  /dev/video3  /dev/video5  /dev/video7
```

```
sudo apt install v4l-utils
```

各デバイス毎に、下記コマンドで解像度、フォーマット、FPSを確認

```
v4l2-ctl --device=/dev/video0 --list-formats-ext
```

## G300のフォーマット


|デバイス|フォーマット|解像度, FPS|
|:--|:--|:--|
|/dev/video0|Z16|1280x800(5,10,15,30fps), 1280x720,(5,10,15,30fps), 848x480(5,10,15,30,60fps),  640x480(5,10,15,30,60,90fps), 640x400(5,10,15,30fps), 640x360(5,10,15,30,60,90fps), 480x270(5,10,15,30,60,90fps), 424x266(5,10,15,30fps), 424x240(5,10,15,30,60,90fps), 848x100(100fps)|
|/dev/video1|-|-|
|/dev/video2|YUYV|1280x800(5,10,15,30,60fps),1280x720(5,10,15,30,60fps),848x480(5,10,15,30,60fps),640x480(5,10,15,30,60fps),640x400(5,10,15,30,60fps),640x360(5,10,15,30,60fps),480x270(5,10,15,30,60fps),424x240(5,10,15,30,60fps)|
|/dev/video3|-|-|
|/dev/video4|GREY|1280x800(5,10,15,30fps),1280x720(5,10,15,30fps),848x480(5,10,15,30,60fps),640x480(5,10,15,30,60,90fps),640x400(5,10,15,30fps),640x360(5,10,15,30,60,90fps),480x270(5,10,15,30,60.90fps),424x266(5,10,15,30fps),424x240(5,10,15,30,60,90fps),848x100(100fps)|
|/dev/video5|-|-|
|/dev/video6|GREY|1280x800(5,10,15,30fps),1280x720(5,10,15,30fps),848x480(5,10,15,30,60fps),640x480(5,10,15,30,60,90fps),640x400(5,10,15,30fps),640x360(5,10,15,30,60,90fps),480x270(5,10,15,30,60.90fps),424x266(5,10,15,30fps),424x240(5,10,15,30,60,90fps),848x100(100fps)|
|/dev/video7|-|-|


## テスト表示

LeRobotで使えそうなフォーマットは、YUYVなので、YUYVで動作テスト。

```
gst-launch-1.0 v4l2src device=/dev/video2 ! \
    'video/x-raw,format=YUY2,width=1280,height=800,framerate=30/1' ! \
    videoconvert ! autovideosink
```