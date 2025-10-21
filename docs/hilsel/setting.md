# HilSerl 環境構築

## HilSerl公式

[https://hil-serl.github.io/](https://hil-serl.github.io/)

## 検証環境

- RTX5090
- Ubuntu24.04
- Anaconda

## Anaconda環境の作成

```
conda create -y -n lerobot_rl python=3.10
conda activate lerobot_rl
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

Transformersもインストール

```
conda install -c conda-forge transformers accelerate safetensors
```

## LeRobotをGit clone

```
git clone https://github.com/huggingface/lerobot/ lerobot_rl
```

```
cd lerobot_rl
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
pip install -e ".[feetech]"
pip install -e ".[hilserl]"
```

```
pip install grpcio grpcio-tools wandb gymnasium mujoco mujoco-py
```

```
pip install scipy pygame
```

## 各種パラメーター解説

|パラメーター|説明|
|:--|:--|
|end_effector_step_sizes|1ステップあたり最大移動量[cm]を設定|
|end_effector_bounds|min：エンドエフェクタ位置の XYZ 各軸の最小値,max：エンドエフェクタ位置の XYZ 各軸の最大値|
|root/type|hilとgym_manipulatorが設定可能|
|robot/type|so100_follower_end_effector, so101_follower_end_effector, koch_follower_end_effector, moss_follower_end_effector|
|teleop/type|so101_leader, so100_leader, koch_leader, gamepad, [widowx](https://www.trossenrobotics.com/widowx-ai), [stretch3_gamepad](https://docs.hello-robot.com/0.3/getting_started/hello_robot/), keyboard|


## カメラ設定例

Realsense

```json hl_lines="5-6 12-13"
    "type": "gym_manipulator",
    "robot": {
        "cameras": {
          "front": {
            "type": "intelrealsense",
            "serial_number_or_name": "008222070291",
            "fps": 30,
            "width": 640,
            "height": 480
            },
          "wrist": {
            "type": "intelrealsense",
            "serial_number_or_name": "138422077679",
            "fps": 30,
            "width": 640,
            "height": 480
            }
        }
    },
```

USB Camera

```
v4l2-ctl -d /dev/video0 --list-formats-ext
```

```json hl_lines="5-6 12-13"
    "type": "gym_manipulator",
    "robot": {
        "cameras": {
            "front": {
                "type": "opencv",
                "index_or_path": 0,
                "height": 480,
                "width": 640,
                "fps": 30
            },
            "wrist": {
                "type": "opencv",
                "index_or_path": 2,
                "height": 480,
                "width": 640,
                "fps": 30
            }
        }
    },
```

## URDF

```
cd ~
git clone https://github.com/TheRobotStudio/SO-ARM100
```

```
cd SO-ARM100/Simulation/SO101/
(base) ubuntu@rtx5090:~/SO-ARM100/Simulation/SO101$ ls
assets                 README.md  so101_new_calib.urdf  so101_old_calib.urdf
joints_properties.xml  scene.xml  so101_new_calib.xml   so101_old_calib.xml
```

`so101_new_calib.urdf`のフォルダをメモし、configに反映

## end_effector_boundsの値の取得

```
python lerobot/scripts/find_joint_limits.py  \
    --robot.type=so100_follower_end_effector  \
    --robot.port=/dev/ttyACM1  \
    --robot.id=black  \
    --teleop.type=so100_leader  \
    --teleop.port=/dev/ttyACM0  \
    --teleop.id=blue \
    --robot.urdf_path=/home/ubuntu/SO-ARM100/Simulation/SO101/so101_new_calib.urdf
```

うまく動かない。原因調査中。

## SO101アーム使用する場合のConfig

<kbd>Space</kbd>を押すと手動モード

!!!info
    JSONファイルの設定は、[aractingi/lerobot-example-config-files](https://huggingface.co/datasets/aractingi/lerobot-example-config-files/tree/main)　を参考に

```json hl_lines="4-6 10-14 17-20 42-46 84 87-88"
{
    "type": "gym_manipulator",
    "robot": {
        "type": "so100_follower_end_effector",
        "port": "/dev/ttyACM1",
        "urdf_path": "/home/ubuntu/SO-ARM100/Simulation/SO101/so101_new_calib.urdf",
        "target_frame_name": "gripper_frame_link",
        "cameras": {
            "front": {
                "type": "opencv",
                "index_or_path": 0,
                "height": 480,
                "width": 640,
                "fps": 30
            },
            "wrist": {
                "type": "opencv",
                "index_or_path": 2,
                "height": 480,
                "width": 640,
                "fps": 30
            }
        },
        "end_effector_bounds": {
            "min": [
                -1.0,
                -1.0,
                -1.0
            ],
            "max": [
                1.0,
                1.0,
                1.0
            ]
        },
        "end_effector_step_sizes": {
            "x": 0.01,
            "y": 0.01,
            "z": 0.01
        }
    },
    "teleop": {
      "type": "so101_leader",
      "port": "/dev/ttyACM0",
      "use_degrees": true
    },
    "wrapper": {
        "display_cameras": false,
        "add_joint_velocity_to_observation": true,
        "add_current_to_observation": true,
        "add_ee_pose_to_observation": true,
        "crop_params_dict": {
            "observation.images.front": [
                270,
                170,
                90,
                190
            ],
            "observation.images.wrist": [
                0,
                0,
                480,
                640
            ]
        },
        "resize_size": [
            128,
            128
        ],
        "control_time_s": 20.0,
        "use_gripper": true,
        "gripper_quantization_threshold": null,
        "gripper_penalty": -0.02,
        "gripper_penalty_in_reward": false,
        "fixed_reset_joint_positions": [
            0.0,
            0.0,
            0.0,
            90.0,
            0.0,
            5.0
        ],
        "reset_time_s": 2.5,
        "control_mode": "leader"
    },
    "name": "real_robot",
    "mode": "record",
    "repo_id": "akira-sasaki/hilserl_test",
    "dataset_root": null,
    "task": "",
    "num_episodes": 2,
    "episode": 0,
    "pretrained_policy_name_or_path": null,
    "device": "cpu",
    "push_to_hub": true,
    "fps": 10,
    "features": {
        "observation.images.front": {
            "type": "VISUAL",
            "shape": [
                3,
                128,
                128
            ]
        },
        "observation.images.wrist": {
            "type": "VISUAL",
            "shape": [
                3,
                128,
                128
            ]
        },
        "observation.state": {
            "type": "STATE",
            "shape": [
                15
            ]
        },
        "action": {
            "type": "ACTION",
            "shape": [
                3
            ]
        }
    },
    "features_map": {
        "observation.images.front": "observation.images.side",
        "observation.images.wrist": "observation.images.wrist",
        "observation.state": "observation.state",
        "action": "action"
    },
    "reward_classifier_pretrained_path": null
}
```

## 初期学習

```
python lerobot/scripts/rl/gym_manipulator.py \
    --config_path lerobot/configs/env_config_so100.json
```

calibrationファイルは、

|デバイス名|ファイルのDIR|
|:--|:--|
|so100_follower_end_effector|~/.cache/huggingface/lerobot/calibration/robots/so100_follower_end_effector|
|so100_leader|~/.cache/huggingface/lerobot/calibration/teleoperators/so100_leader|


## Train_config

```json hl_lines="12-16 18 24 204-206 210-214 217-221 238-242 280"
{
    "output_dir": null,
    "job_name": "default",
    "resume": false,
    "seed": 1000,
    "num_workers": 4,
    "batch_size": 256,
    "steps": 100000,
    "log_freq": 500,
    "save_checkpoint": true,
    "save_freq": 2000000,
    "wandb": {
        "enable": true,
        "project": "so100_real",
        "disable_artifact": true
    },
    "dataset": {
        "repo_id": "akira-sasaki/hilserl_test",
        "use_imagenet_stats": false
    },
    "policy": {
        "type": "sac",
        "n_obs_steps": 1,
        "repo_id": "akira-sasaki/policy_hilserl_test",
        "normalization_mapping": {
            "VISUAL": "MEAN_STD",
            "STATE": "MIN_MAX",
            "ENV": "MIN_MAX",
            "ACTION": "MIN_MAX"
        },
        "input_features": {
            "observation.images.side": {
                "type": "VISUAL",
                "shape": [
                    3,
                    128,
                    128
                ]
            },
            "observation.images.front": {
                "type": "VISUAL",
                "shape": [
                    3,
                    128,
                    128
                ]
            },
            "observation.state": {
                "type": "STATE",
                "shape": [
                    15
                ]
            }
        },
        "device": "cuda",
        "use_amp": false,
        "dataset_stats": {
            "observation.images.side": {
                "mean": [
                    0.485,
                    0.456,
                    0.406
                ],
                "std": [
                    0.229,
                    0.224,
                    0.225
                ]
            },
            "observation.images.front": {
                "mean": [
                    0.485,
                    0.456,
                    0.406
                ],
                "std": [
                    0.229,
                    0.224,
                    0.225
                ]
            },
            "observation.state": {
                "min": [
                    -15.0,
                    -20.0,
                    10.0,
                    65.0,
                    0.0,
                    0.0,
                    -40.0,
                    -60.0,
                    -50.0,
                    -80.0,
                    -10.0,
                    -110.0,
                    -15.0,
                    -20.0,
                    15.0,
                    70.0,
                    -5.0,
                    0.0,
                    0.26,
                    -0.06,
                    0.25
                ],
                "max": [
                    15.0,
                    15.0,
                    40.0,
                    110.0,
                    0.5,
                    31.0,
                    53.0,
                    61.0,
                    67.0,
                    90.0,
                    6.0,
                    100.0,
                    15.0,
                    12.0,
                    40.0,
                    110.0,
                    0.5,
                    31.0,
                    0.32,
                    0.06,
                    0.35
                ]
            },
            "action": {
                "min": [
                    -0.03,
                    -0.03,
                    -0.03
                ],
                "max": [
                    0.03,
                    0.03,
                    0.03
                ]
            }
        },
        "num_discrete_actions": 3,
        "storage_device": "cuda",
        "vision_encoder_name": "helper2424/resnet10",
        "freeze_vision_encoder": true,
        "image_encoder_hidden_dim": 32,
        "shared_encoder": true,
        "online_steps": 1000000,
        "online_env_seed": 10000,
        "online_buffer_capacity": 30000,
        "offline_buffer_capacity": 10000,
        "online_step_before_learning": 100,
        "policy_update_freq": 1,
        "discount": 0.97,
        "async_prefetch": false,
        "temperature_init": 0.01,
        "num_critics": 2,
        "num_subsample_critics": null,
        "critic_lr": 0.0003,
        "actor_lr": 0.0003,
        "temperature_lr": 0.0003,
        "critic_target_update_weight": 0.005,
        "utd_ratio": 2,
        "state_encoder_hidden_dim": 256,
        "latent_dim": 256,
        "target_entropy": null,
        "use_backup_entropy": true,
        "grad_clip_norm": 40.0,
        "critic_network_kwargs": {
            "hidden_dims": [
                256,
                256
            ],
            "activate_final": true,
            "final_activation": null
        },
        "actor_network_kwargs": {
            "hidden_dims": [
                256,
                256
            ],
            "activate_final": true
        },
        "policy_kwargs": {
            "use_tanh_squash": true,
            "std_min": -5,
            "std_max": 2,
            "init_final": 0.05
        },
        "actor_learner_config": {
            "learner_host": "127.0.0.1",
            "learner_port": 50051,
            "policy_parameters_push_frequency": 4
        },
        "concurrency": {
            "actor": "threads",
            "learner": "threads"
        }
    },
    "env": {
        "type": "gym_manipulator",
        "robot": {
            "type": "so100_follower_end_effector",
            "port": "/dev/ttyACM1",
            "urdf_path": "/home/ubuntu/SO-ARM100/Simulation/SO101/so101_new_calib.urdf",
            "target_frame_name": "gripper_frame_link",
            "cameras": {
                "front": {
                    "type": "opencv",
                    "index_or_path": 2,
                    "height": 480,
                    "width": 640,
                    "fps": 30
                },
                "wrist": {
                    "type": "opencv",
                    "index_or_path": 8,
                    "height": 480,
                    "width": 640,
                    "fps": 30
                }
            },
            "end_effector_bounds": {
                "min": [
                    -1.0,
                    -1.0,
                    -1.0
                ],
                "max": [
                    1.0,
                    1.0,
                    1.0
                ]
            },
            "max_gripper_pos": 30
        },
        "teleop": {
          "type": "so101_leader",
          "port": "/dev/ttyACM0",
          "use_degrees": true
        },
        "wrapper": {
            "display_cameras": false,
            "add_joint_velocity_to_observation": true,
            "add_current_to_observation": true,
            "add_ee_pose_to_observation": true,
            "crop_params_dict": {
                "observation.images.front": [
                    270,
                    170,
                    90,
                    190
                ],
                "observation.images.wrist": [
                    0,
                    0,
                    480,
                    640
                ]
            },
            "resize_size": [
                128,
                128
            ],
            "control_time_s": 20.0,
            "use_gripper": true,
            "gripper_quantization_threshold": null,
            "gripper_penalty": -0.02,
            "gripper_penalty_in_reward": false,
            "fixed_reset_joint_positions": [
                0.0,
                -20.0,
                20.0,
                90.0,
                0.0,
                30.0
            ],
            "reset_time_s": 2.5,
            "control_mode": "leader"
        },
        "name": "real_robot",
        "mode": null,
        "repo_id": null,
        "dataset_root": null,
        "task": "",
        "num_episodes": 0,
        "episode": 0,
        "pretrained_policy_name_or_path": null,
        "device": "cuda",
        "push_to_hub": true,
        "fps": 10,
        "features": {
            "observation.images.front": {
                "type": "VISUAL",
                "shape": [
                    3,
                    128,
                    128
                ]
            },
            "observation.images.wrist": {
                "type": "VISUAL",
                "shape": [
                    3,
                    128,
                    128
                ]
            },
            "observation.state": {
                "type": "STATE",
                "shape": [
                    15
                ]
            },
            "action": {
                "type": "ACTION",
                "shape": [
                    3
                ]
            }
        },
        "features_map": {
            "observation.images.front": "observation.images.side",
            "observation.images.wrist": "observation.images.wrist",
            "observation.state": "observation.state",
            "action": "action"
        }
    }
}
```


## Learner

```
pip install --upgrade --extra-index-url https://download.pytorch.org/whl/nightly \
    "triton>=3.3.0"
```

```
python lerobot/scripts/rl/learner_service.py \
    --config_path lerobot/configs/train_config_hilserl_so100.json
```

## Actor

```
python lerobot/scripts/rl/actor.py \
    --config_path src/lerobot/configs/train_config_hilserl_so100.json
```

## Reference

- [https://huggingface.co/docs/lerobot/hilserl](https://huggingface.co/docs/lerobot/hilserl)
- [https://huggingface.co/datasets/aractingi/lerobot-example-config-files/tree/main](https://huggingface.co/datasets/aractingi/lerobot-example-config-files/tree/main)
