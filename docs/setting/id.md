# ID割り振り

## Follower

```
python -m lerobot.setup_motors \
    --robot.type=so101_follower \
    --robot.port=/dev/ttyACM0
```

```
python -m lerobot.setup_motors \
	--robot.type=koch_follower \
	--robot.port=/dev/ttyUSB0
```

## Leader


```
python -m lerobot.setup_motors \
    --teleop.type=so101_follower \
    --teleop.port=/dev/ttyACM0
```

```
python -m lerobot.setup_motors \
	--teleop.type=koch_leader \
	--teleop.port=/dev/ttyUSB1
```

