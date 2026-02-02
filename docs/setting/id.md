# ID割り振り

## LeRobot環境の構築

LeRobot環境は、Python3.10系でconda環境で構築します。

```
conda create -y -n lerobot python=3.10
conda activate lerobot 
```

```
pip install lerobot
pip install feetech-servo-sdk
```


## Follower

```
lerobot-setup-motors \
	--robot.type=so101_follower \
	--robot.port=/dev/tty.usbmodem5AA90176811
```

`/dev/tty.usbmodem5AA90176811`は、自分の環境に合わせてください。


|ID| 場所 | Code| ギア比　|
|:--|:--|:--|:--|
|6|	gripper | STS3215-C001 | 1 / 345 |
|5|	wrist_roll | STS3215-C001 | 1 / 345 |
|4|	wrist_flex | STS3215-C001 | 1 / 345 |
|3|	elbow_flex | STS3215-C001 | 1 / 345 |
|2| shoulder_lift | STS3215-C001 | 1 / 345 |
|1|	shoulder_pan | STS3215-C001 | 1 / 345 |


## Leader

```
lerobot-setup-motors \
	--teleop.type=so101_leader \
	--teleop.port=/dev/tty.usbmodem5AA90176811
```

|ID|場所 | Code| ギア比　|
|:--|:--|:--|:--|
|6|	gripper | STS3215-C046 | 1 / 147 |
|5|	wrist_roll |STS3215-C046 | 1 / 147 |
|4|	wrist_flex |STS3215-C046 | 1 / 147 |
|3|	elbow_flex | STS3215-C044 | 1 / 191 |
|2| shoulder_lift | STS3215-C001 | 1 / 345 |
|1|	shoulder_pan | STS3215-C044 | 1 / 191 |

## Reference

- [Feetech社 ST3215](https://www.feetechrc.com/products.html?keyword=STS3215)
- [LeRobot SO-101](https://huggingface.co/docs/lerobot/so101)
