# smolVLA環境構築

## マニュアル

[SmolVLA: Efficient Vision-Language-Action Model trained on Lerobot Community Data](https://huggingface.co/blog/smolvla)

## 検証環境

- RTX5090
- Ubuntu24.04
- Anaconda

## Anaconda環境の作成

```
conda create -y -n smolvla python=3.10
conda activate smolvla
```

```
conda install ffmpeg -c conda-forge
```

RTX5090は、CUDA12.8対応なので、nightly buildから展開


```
pip install --extra-index-url https://download.pytorch.org/whl/nightly/cu128 \
torch==2.8.0.dev20250603+cu128 torchvision==0.23.0.dev20250603+cu128 torchaudio==2.8.0.dev20250603+cu128
```

```
pip install triton==2.1.0 --index-url https://download.pytorch.org/whl/nightly/cu128
```

チェック

```
python -c "import torch; print(torch.__version__)"
2.8.0.dev20250603+cu128
```

```
python -c "import torchvision; print(torchvision.__version__)"
0.23.0.dev20250603+cu128
```

```
python -c "import torchaudio; print(torchaudio.__version__)"
2.8.0.dev20250603+cu128
```

## LeRobotをGit clone

``` 
git clone https://github.com/huggingface/lerobot.git smolvla
```

```
cd smolvla
```

pyproject.toml

```json hl_lines="25-27"
dependencies = [
    "cmake>=3.29.0.1",
    "datasets>=2.19.0",
    "deepdiff>=7.0.1",
    "diffusers>=0.27.2",
    "draccus==0.10.0",
    "einops>=0.8.0",
    "flask>=3.0.3",
    "gdown>=5.1.0",
    "gymnasium==0.29.1",                                                 # TODO(rcadene, aliberts): Make gym 1.0.0 work
    "h5py>=3.10.0",
    "huggingface-hub[hf-transfer,cli]>=0.27.1 ; python_version < '4.0'",
    "imageio[ffmpeg]>=2.34.0",
    "jsonlines>=4.0.0",
    "numba>=0.59.0",
    "omegaconf>=2.3.0",
    "opencv-python-headless>=4.9.0",
    "packaging>=24.2",
    "av>=14.2.0",
    "pymunk>=6.6.0",
    "pynput>=1.7.7",
    "pyzmq>=26.2.1",
    "rerun-sdk>=0.21.0",
    "termcolor>=2.4.0",
    #"torch>=2.2.1,<2.7",
    #"torchcodec==0.2.1; sys_platform != 'win32' and (sys_platform != 'linux' or (platform_machine != 'aarch64' and platform_machine != 'arm64' and platform_machine != 'armv7l')) and (sys_platform != 'darwin' or platform_machine != 'x86_64')",
    #"torchvision>=0.21.0",
    "wandb>=0.16.3",
    "zarr>=2.17.0",
]
```

```
pip install -e .[smolvla]
```

```
pip install -e .[feetech]
```


## SO-100/101の設定

./lerobot/common/robot_devices/robots/configs.py

```json hl_lines="11 28 45 51"
class So100RobotConfig(ManipulatorRobotConfig):
    calibration_dir: str = ".cache/calibration/so100"
    # `max_relative_target` limits the magnitude of the relative positional target vector for safety purposes.
    # Set this to a positive scalar to have the same value for all motors, or a list that is the same length as
    # the number of motors in your follower arms.
    max_relative_target: int | None = None

    leader_arms: dict[str, MotorsBusConfig] = field(
        default_factory=lambda: {
            "main": FeetechMotorsBusConfig(
                port="/dev/ttyACM1",
                motors={
                    # name: (index, model)
                    "shoulder_pan": [1, "sts3215"],
                    "shoulder_lift": [2, "sts3215"],
                    "elbow_flex": [3, "sts3215"],
                    "wrist_flex": [4, "sts3215"],
                    "wrist_roll": [5, "sts3215"],
                    "gripper": [6, "sts3215"],
                },
            ),
        }
    )

    follower_arms: dict[str, MotorsBusConfig] = field(
        default_factory=lambda: {
            "main": FeetechMotorsBusConfig(
                port="/dev/ttyACM0",
                motors={
                    # name: (index, model)
                    "shoulder_pan": [1, "sts3215"],
                    "shoulder_lift": [2, "sts3215"],
                    "elbow_flex": [3, "sts3215"],
                    "wrist_flex": [4, "sts3215"],
                    "wrist_roll": [5, "sts3215"],
                    "gripper": [6, "sts3215"],
                },
            ),
        }
    )

    cameras: dict[str, CameraConfig] = field(
        default_factory=lambda: {
            "laptop": OpenCVCameraConfig(
                camera_index=0,
                fps=30,
                width=640,
                height=480,
            ),
            "phone": OpenCVCameraConfig(
                camera_index=2,
                fps=30,
                width=640,
                height=480,
            ),
        }
    )

```


## ロボットアームのキャリブレーション

他のプロジェクトからキャリブレーション済みの./cache/をコピーしてもいいが、新規に実施する場合は、下記コマンドでキャリブレーション。

```
python lerobot/scripts/control_robot.py \
  --robot.type=so100 \
  --robot.cameras='{}' \
  --control.type=calibrate \
  --control.arms='["main_follower"]'
```

```
python lerobot/scripts/control_robot.py \
  --robot.type=so100 \
  --robot.cameras='{}' \
  --control.type=calibrate \
  --control.arms='["main_leader"]'
```

## ロボットアームでのデータセット作成

```
python lerobot/scripts/control_robot.py  \
    --robot.type=so100 \
    --control.type=record \
    --control.fps=30 \
    --control.single_task="Grasp a lego block and put it in the bin." \
    --control.repo_id=akira-sasaki/so100_smolvla \
    --control.tags='["so100","smovla"]' \
    --control.warmup_time_s=3 \
    --control.episode_time_s=10 \
    --control.reset_time_s=3 \
    --control.num_episodes=30 \
    --control.display_data=false \
    --control.push_to_hub=true
```

## smolVLAでFinetuning

```
python lerobot/scripts/train.py \
    --policy.path=lerobot/smolvla_base \
    --dataset.repo_id=akira-sasaki/so100_smolvla \
    --batch_size=64 \
    --steps=200000
```

学習時間の目安

|GPU|ステップ数|時間|
|:--|:--|:--|
|RTX5090|20_000_000 | 25時間 |

## 推論実行


`./lerobot/common/policies/utils.py`を修正

```
def populate_queues(queues, batch, exclude_keys=None):
    if exclude_keys is None:
        exclude_keys = []

    for key in batch:
        if key in exclude_keys:
            continue
        # Ignore keys not in the queues already (leaving the responsibility to the caller to make sure the
        # queues have the keys they want).
        if key not in queues:
            continue
        if len(queues[key]) != queues[key].maxlen:
            # initialize by copying the first observation several times until the queue is full
            while len(queues[key]) != queues[key].maxlen:
                queues[key].append(batch[key])
        else:
            # add latest observation to the queue
            queues[key].append(batch[key])
    return queues
```

推論を実行

outputs/train/2025-06-04/17-57-18_smolvla/checkpoints/last/のconfig.jsonのn_action_stepsを1から50に修正

```
python lerobot/scripts/control_robot.py \
  --robot.type=so100 \
  --control.type=record \
  --control.fps=30 \
  --control.single_task="Remove the cube from the box." \
  --control.repo_id=akira-sasaki/eval_smolvla_pick_and_remove \
  --control.tags='["smolvla","so100"]' \
  --control.warmup_time_s=5 \
  --control.episode_time_s=30 \
  --control.reset_time_s=5 \
  --control.num_episodes=3 \
  --control.push_to_hub=true \
  --control.policy.path=outputs/train/2025-06-07/18-37-02_smolvla/checkpoints/140000/pretrained_model/
```