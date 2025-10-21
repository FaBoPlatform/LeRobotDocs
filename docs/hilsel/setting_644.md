# HilSerl 環境構築(#644)

## HilSerl公式

[https://hil-serl.github.io/](https://hil-serl.github.io/)

## LeRobotでの対応

[https://github.com/huggingface/lerobot/pull/644](https://github.com/huggingface/lerobot/pull/644)


## マニュアル

[https://github.com/michel-aractingi/lerobot-hilserl-guide](https://github.com/michel-aractingi/lerobot-hilserl-guide)

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

```
git fetch origin pull/644/head:pr644
git checkout pr644
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
pip install -e .[feetech]
```

```
pip install grpcio grpcio-tools wandb gymnasium mujoco mujoco-py
```

```
pip install scipy pygame
```

## JoystickのinputをUser groupに追加

```
sudo usermod -aG input $USER
```

## SO-100/101の設定

./lerobot/common/robot_devices/robots/configs.py

```
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


## 稼働範囲の取得

```
python lerobot/scripts/server/find_joint_limits.py \
  --mode ee \
  --control-time-s 60 \
  --robot-type so100
```

```
Max ee position [0.43667077 0.24992244 0.48715585]
Min ee position [-0.09507553 -0.29766109 -0.01841555]
```

## env_config_so100.jsonの作成

サンプルでは、`use_relative_joint_positions`, `open_gripper_on_reset`, `joint_masking_action_space`があるが無効になっているので項目を削除しておく。


`lerobot/configs/env_config_so100.json`


```console hl_lines="9 41 48 98-100 103-105 113 116"
{
    "type": "gym_manipulator",
    "robot": {
        "type": "so100",
        "leader_arms": {},
        "follower_arms": {
            "main": {
                "type": "feetech",
                "port": "/dev/ttyACM0",
                "motors": {
                    "shoulder_pan": [
                        1,
                        "sts3215"
                    ],
                    "shoulder_lift": [
                        2,
                        "sts3215"
                    ],
                    "elbow_flex": [
                        3,
                        "sts3215"
                    ],
                    "wrist_flex": [
                        4,
                        "sts3215"
                    ],
                    "wrist_roll": [
                        5,
                        "sts3215"
                    ],
                    "gripper": [
                        6,
                        "sts3215"
                    ]
                }
            }
        },
        "cameras": {
            "front": {
                "type": "opencv",
                "camera_index": 0,
                "height": 480,
                "width": 640,
                "fps": 15
            },
            "wrist": {
                "type": "opencv",
                "camera_index": 2,
                "height": 480,
                "width": 640,
                "fps": 15
            }
        }
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
            -0.0,
            110.0,
            120.0,
            70.0,
            -90.0,
            30.0
        ],
        "reset_time_s": 2.5,
        "ee_action_space_params": {
            "x_step_size": 0.03,
            "y_step_size": 0.03,
            "z_step_size": 0.03,
            "bounds": {
                "max": [
                    0.43667077, 
                    0.24992244,
                    0.48715585
                ],
                "min": [
                    -0.09507553, 
                    -0.29766109,
                    -0.01841555
                ]
            },
            "control_mode": "gamepad"
        }
    },
    "name": "real_robot",
    "mode": "record",
    "repo_id": "akira-sasaki/pick_place_cube_wrist_cam_3",
    "dataset_root": null,
    "task": "",
    "num_episodes": 3,
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
    "features_map": {}
}
```

gym_manipulatorを起動し、データセットを収集。

```
python lerobot/scripts/server/gym_manipulator.py --config_path lerobot/configs/env_config_so100.json
```

## 強化学習用のtrain_config_hilserl_so100.jsonの作成


サンプルでは、`use_relative_joint_positions`, `open_gripper_on_reset`, `joint_masking_action_space`, `use_gamepad`,`camera_number`があるが無効になっているので項目を削除しておく。


`lerobot/configs/train_config_hilserl_so100.json`

```json hl_lines="18 250 257 307-309 312-314 359-364"
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
    "save_freq": 5000,
    "wandb": {
        "enable": true,
        "project": "so100_real",
        "disable_artifact": true
    },
    "dataset": {
        "repo_id": "akira-sasaki/pick_place_cube_wrist_cam_3",
        "use_imagenet_stats": false
    },
    "policy": {
        "type": "sac",
        "n_obs_steps": 1,
        "normalization_mapping": {
            "VISUAL": "MEAN_STD",
            "STATE": "MIN_MAX",
            "ENV": "MIN_MAX",
            "ACTION": "MIN_MAX"
        },
        "input_features": {
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
                    21
                ]
            }
        },
        "output_features": {
            "action": {
                "type": "ACTION",
                "shape": [
                    3
                ]
            }
        },
        "device": "cuda",
        "use_amp": false,
        "dataset_stats": {
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
            "observation.images.wrist": {
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
                    -10.0,
                    93.0,
                    125.0,
                    25.0,
                    -86.0,
                    0.0,
                    -66.0,
                    -74.0,
                    -10.0,
                    -76.0,
                    -4.0,
                    -164.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.15,
                    -0.08,
                    -0.01
                ],
                "max": [
                    25.0,
                    121.0,
                    147.0,
                    73.0,
                    -85.0,
                    25.0,
                    69.0,
                    50.0,
                    28.0,
                    67.0,
                    4.0,
                    163.0,
                    500.0,
                    500.0,
                    500.0,
                    500.0,
                    500.0,
                    500.0,
                    0.35,
                    0.03,
                    0.1
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
        "storage_device": "cpu",
        "vision_encoder_name": "helper2424/resnet10",
        "freeze_vision_encoder": true,
        "image_encoder_hidden_dim": 32,
        "shared_encoder": true,
        "online_steps": 1000000,
        "online_env_seed": 10000,
        "online_buffer_capacity": 100000,
        "offline_buffer_capacity": 100000,
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
            "log_std_min": 1e-5,
            "log_std_max": 5.0,
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
            "type": "so100",
            "leader_arms": {},
            "follower_arms": {
                "main": {
                    "type": "feetech",
                    "port": "/dev/ttyACM0",
                    "motors": {
                        "shoulder_pan": [
                            1,
                            "sts3215"
                        ],
                        "shoulder_lift": [
                            2,
                            "sts3215"
                        ],
                        "elbow_flex": [
                            3,
                            "sts3215"
                        ],
                        "wrist_flex": [
                            4,
                            "sts3215"
                        ],
                        "wrist_roll": [
                            5,
                            "sts3215"
                        ],
                        "gripper": [
                            6,
                            "sts3215"
                        ]
                    }
                }
            },
            "cameras": {
                "front": {
                    "type": "opencv",
                    "camera_index": 0,
                    "height": 480,
                    "width": 640,
                    "fps": 15
                },
                "wrist": {
                    "type": "opencv",
                    "camera_index": 2,
                    "height": 480,
                    "width": 640,
                    "fps": 15
                }
            }
        },
        "wrapper": {
            "display_cameras": false,
            "add_joint_velocity_to_observation": true,
            "add_current_to_observation": true,
            "add_ee_pose_to_observation": true,
            "crop_params_dict": {
                "observation.images.front": [
                    160,
                    220,
                    120,
                    150
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
            "control_time_s": 10.0,
            "use_gripper": true,
            "gripper_quantization_threshold": null,
            "gripper_penalty": -0.02,
            "gripper_penalty_in_reward": false,
            "fixed_reset_joint_positions": [
                -0.0,
                110.0,
                120.0,
                70.0,
                -90.0,
                25.0
            ],
            "reset_time_s": 2.5,
            "ee_action_space_params": {
                "x_step_size": 0.03,
                "y_step_size": 0.03,
                "z_step_size": 0.03,
              "bounds": {
                  "max": [
                      0.43667077, 
                      0.24992244,
                      0.48715585
                  ],
                  "min": [
                      -0.09507553, 
                      -0.29766109,
                      -0.01841555
                  ]
              }
            }
        },
        "name": "real_robot",
        "mode": null,
        "repo_id": null,
        "dataset_root": null,
        "task": "",
        "num_episodes": 15,
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
                    21
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
          "action": "action",
          "observation.images.front": "observation.images.front",
          "observation.images.wrist": "observation.images.wrist",
          "observation.state":        "observation.state"
        }
    }

}
```

## Lernerの起動


```
python lerobot/scripts/server/learner_server.py --config_path lerobot/configs/train_config_hilserl_so100.json
```


## Actorの起動

```
python lerobot/scripts/server/actor_server.py --config_path lerobot/configs/train_config_hilserl_so100.json
```
