# LeRobot Core

## Teleop最小サンプル

Teleopの最終サンプルです。

!!!Warning
    lerobot-teleoperator-###/lerobot_teleoperator_### のように、パッケージ名には`lerobot_teleoperator_`から始める必要がありそうです。


## ディレクトリ構成

- `lerobot-teleoperator-keyboard/setup.py`
- `lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/__init__.py`
- `lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/congig_teleop.py`
- `lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/teleop.py`

## setup.py

`lerobot-teleoperator-keyboard/setup.py`

```python hl_lines="4"
from setuptools import setup, find_packages

setup(
    name="lerobot_teleoperator_keyboard",
    version="0.0.1",
    description="LeRobot teleop integration",
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


`lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/__init__.py`

```python
from .config_teleop import TeleopConfig
from .teleop import Teleop
```

## config_teleop.py

`lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/congig_teleop.py`

```python
from dataclasses import dataclass
from lerobot.teleoperators.config import TeleoperatorConfig

@TeleoperatorConfig.register_subclass("lerobot_teleop")
@dataclass
class TeleopConfig(TeleoperatorConfig):
    port: str = "4443"
    host: str = "0.0.0.0"
    use_gripper: bool = True  # 契約を守るためデフォルトは True のまま
```

## teleop.py

`lerobot-teleoperator-keyboard/lerobot_teleoperator_keyboard/teleop.py`

```python
from typing import Any
import sys, select, termios, tty

from lerobot.teleoperators.teleoperator import Teleoperator
from .config_teleop import TeleopConfig

SPEED = 0.5  # [units/sec] a/w/d/x で与える速度

class Teleop(Teleoperator):
    """
    キーボード teleop（最小）
    - a,w,d,x: 左・上・右・下（速度設定）
    - s: 停止
    毎フレーム {vx, vy} を返す。フィードバックは一切受け取りません。
    """
    config_class = TeleopConfig
    name = "keyboard_min"

    def __init__(self, config: TeleopConfig):
        super().__init__(config)
        self.config = config

        self._connected = False
        self._calibrated = True

        # 現在の指令速度（stateful）
        self._vx: float = 0.0
        self._vy: float = 0.0

        # 端末 raw 設定用
        self._fd = None
        self._orig_attr = None

    # ----- Teleoperator interface -----
    @property
    def action_features(self) -> dict[str, type]:
        # Robot 側と一致させる
        return {"vx": float, "vy": float}

    @property
    def feedback_features(self) -> dict[str, type]:
        # フィードバックは使わない
        return {}

    @property
    def is_connected(self) -> bool:
        return self._connected

    def connect(self, calibrate: bool = True) -> None:
        # Enter なしで 1 文字入力を取るために cbreak
        self._fd = sys.stdin.fileno()
        self._orig_attr = termios.tcgetattr(self._fd)
        tty.setcbreak(self._fd)
        self._connected = True
        print("[teleop] a:Left w:Up d:Right x:Down s:Stop  (Ctrl-C to exit)")
        print("[teleop] keyboard_min ready")

    @property
    def is_calibrated(self) -> bool:
        return self._calibrated

    def calibrate(self) -> None:
        pass

    def configure(self) -> None:
        pass

    def disconnect(self) -> None:
        self._connected = False
        if self._orig_attr is not None:
            try:
                termios.tcsetattr(self._fd, termios.TCSADRAIN, self._orig_attr)
            except Exception:
                pass

    # ----- 入力読み取り（非ブロッキング） -----
    def _read_keys(self) -> None:
        while True:
            r, _, _ = select.select([sys.stdin], [], [], 0)
            if not r:
                break
            ch = sys.stdin.read(1)
            if not ch:
                break

            if ch == "a":       # 左
                self._vx, self._vy = -SPEED, 0.0
            elif ch == "d":     # 右
                self._vx, self._vy = +SPEED, 0.0
            elif ch == "w":     # 上
                self._vx, self._vy = 0.0, +SPEED
            elif ch == "x":     # 下
                self._vx, self._vy = 0.0, -SPEED
            elif ch == "s":     # 停止
                self._vx, self._vy = 0.0, 0.0
            # それ以外は無視

    # ----- 出力（毎フレーム呼ばれる） -----
    def get_action(self) -> dict[str, Any]:
        self._read_keys()
        return {"vx": float(self._vx), "vy": float(self._vy)}

    def send_feedback(self, feedback: dict[str, float]) -> None:
        # フィードバックは扱わない
        pass
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