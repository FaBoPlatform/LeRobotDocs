# LeRobot Core

## Robot最小サンプル

Robotの最終サンプルです。

!!!Warning
    lerobot-robot-###/lerobot_robot_### のように、パッケージ名には`lerobot_robot_`から始める必要がありそうです。


## ディレクトリ構成

- `lerobot-robot-bot/setup.py`
- `lerobot-robot-bot/lerobot_robot_bot/__init__.py`
- `lerobot-robot-bot/lerobot_robot_bot/congig_bot.py`
- `lerobot-robot-bot/lerobot_robot_bot/bot.py`

## setup.py

`lerobot-robot-bot/setup.py`

```python hl_lines="4"
from setuptools import setup, find_packages

setup(
    name="lerobot_robot_bot",
    version="0.0.1",
    description="LeRobot Bot integration",
    author="FaBo, Inc.",
    author_email="akira@fabo.io",
    packages=find_packages(),
    install_requires=[
        "numpy",
        "transforms3d",
        "teleop",
        "lerobot",
    ],
    python_requires=">=3.7",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: Apache License",
        "Operating System :: OS Independent",
    ],
)
```

## __init__.py


`lerobot-robot-bot/lerobot_robot_bot/__init__.py`

```python
from .config_bot import BotConfig
from .bot import Bot
```

## config_bot.py

`lerobot-robot-bot/lerobot_robot_bot/congig_bot.py`

```python
from dataclasses import dataclass, field
from lerobot.robots.config import RobotConfig
from lerobot.cameras import CameraConfig

@RobotConfig.register_subclass("lerobot_robot_bot")
@dataclass
class BotConfig(RobotConfig):
    ip: str = "0.0.0.0"
    port: int = 4443
    cameras: dict[str, CameraConfig] = field(default_factory=dict)
    use_effort: bool = False  # observation_features で参照するため宣言
```

## bot.py

`lerobot-robot-bot/lerobot_robot_bot/bot.py`

```python
from typing import Any
import time

from lerobot.utils.errors import DeviceNotConnectedError, DeviceAlreadyConnectedError
from lerobot.robots.robot import Robot
from .config_bot import BotConfig

class Bot(Robot):
    """
    ダミー 2D ロボット
    - action_features: {vx, vy} [units/sec]
    - observation_features: {x, y} [units]
    """
    config_class = BotConfig
    name = "bot"

    def __init__(self, config: BotConfig):
        super().__init__(config)
        self.config = config

        self._is_connected = False
        self._x: float = 0.0
        self._y: float = 0.0
        self._last_t: float | None = None

    # ----- 接続系 -----
    def connect(self, calibrate: bool = True) -> None:
        if self.is_connected:
            raise DeviceAlreadyConnectedError(f"{self} already connected")
        self._is_connected = True
        self._last_t = time.time()
        print(f"{self} connected.")

    def disconnect(self) -> None:
        if not self.is_connected:
            return
        self._is_connected = False
        print(f"{self} disconnected.")

    def calibrate(self) -> None:
        pass

    def configure(self) -> None:
        if not self.is_connected:
            raise DeviceNotConnectedError(f"{self} is not connected.")

    # ----- 抽象プロパティ実装 -----
    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @is_connected.setter
    def is_connected(self, value: bool) -> None:
        self._is_connected = value

    @property
    def is_calibrated(self) -> bool:
        return self.is_connected

    @property
    def observation_features(self) -> dict[str, Any]:
        return {"x": float, "y": float}

    @property
    def action_features(self) -> dict[str, type]:
        return {"vx": float, "vy": float}

    # ----- I/O -----
    def send_action(self, action: dict[str, Any]) -> dict[str, Any]:
        """
        vx, vy を dt 積分して内部位置 (x,y) を更新
        """
        if not self.is_connected:
            raise DeviceNotConnectedError(f"{self} is not connected.")

        now = time.time()
        if self._last_t is None:
            self._last_t = now
        dt = now - self._last_t
        self._last_t = now

        vx = float(action.get("vx", 0.0))
        vy = float(action.get("vy", 0.0))

        self._x += vx * dt
        self._y += vy * dt

        # デバッグ表示（必要なら）
        # print(f"[robot] vx={vx:+.2f}, vy={vy:+.2f}, x={self._x:.3f}, y={self._y:.3f}")

        # 返り値は「送ったコマンド」をそのまま返しておけば display に出る
        return {"vx": vx, "vy": vy}

    def get_observation(self) -> dict[str, Any]:
        if not self.is_connected:
            raise DeviceNotConnectedError(f"{self} is not connected.")
        print(f"leracer:x={float(self._x)},y={float(self._y)}")
        return {"x": float(self._x), "y": float(self._y)}
```


## Install

```
pip install -e .
```

## Teleop

```
lerobot-teleoperate \
    --robot.type=lerobot_robot_bot \
    --robot.id=black \
    --teleop.type=lerobot_teleoperator_keyboard  \
    --fps=60
```