# ID割り振り

## 環境構築

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
	--robot.type=koch_follower \
	--robot.port=/dev/tty.usbmodem5AA90176811
```

`/dev/tty.usbmodem5AA90176811`は、各環境に合わせて調整。


|ID| 場所 | Code| ギア比　|
|:--|:--|:--|:--|
|6|	gripper | STS3215-C001 | 1 / 345 |
|5|	wrist_roll | STS3215-C001 | 1 / 345 |
|4|	wrist_flex | STS3215-C001 | 1 / 345 |
|3|	elbow_flex | STS3215-C001 | 1 / 345 |
|2| shoulder_lift | STS3215-C001 | 1 / 345 |
|1|	shoulder_pan | STS3215-C001 | 1 / 345 |

```
lerobot-setup-motors \                    
	--robot.type=koch_follower \
	--robot.port=/dev/tty.usbmodem5AA90176811
```
## Leader

```
lerobot-setup-motors \                    
	--teleop.type=so101_follower \
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

```
python -m lerobot.setup_motors \
	--teleop.type=koch_leader \
	--teleop.port=/dev/ttyUSB1
```

