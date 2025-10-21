# GR00T N1.5環境構築

## 構築環境

|項目|内容|
|:--|:--|
|GPU|RTX5090|
|OS|Ubuntu24.04|

## GR00Tをgit clone

```
git clone https://github.com/NVIDIA/Isaac-GR00T
```

## Dockerの構築


```
cd Isaac-GR00T
```

```
docker build -t isaac-gr00t .
```

## Dockerを起動

```
docker run --gpus all -it --shm-size=16g --rm isaac-gr00t
```


## 推論の実行(TEST)

```
python scripts/inference_service.py --model_path nvidia/GR00T-N1.5-2B --server
```

サーバが起動すれば実行成功です。

```
Tune action head projector: True
Tune action head diffusion model: True
Set action denoising steps to 4
Server is ready and listening on tcp://0.0.0.0:5555
```



## SO-101のデモデータをLocalにDownload

```
huggingface-cli download \
    --repo-type dataset youliangtan/so101-table-cleanup \
    --local-dir ./demo_data/so101-table-cleanup
```

## modalityファイルを作成

```
wget https://raw.githubusercontent.com/NVIDIA/Isaac-GR00T/refs/heads/main/examples/SO-100/so100_dualcam__modality.json \
     -O ./demo_data/so101-table-cleanup/meta/modality.json
```

`so100_dualcam__modality.json`

```json
{
    "state": {
        "single_arm": {
            "start": 0,
            "end": 5
        },
        "gripper": {
            "start": 5,
            "end": 6
        }
    },
    "action": {
        "single_arm": {
            "start": 0,
            "end": 5
        },
        "gripper": {
            "start": 5,
            "end": 6
        }
    },
    "video": {
        "front": {
            "original_key": "observation.images.front"
        },
        "wrist": {
            "original_key": "observation.images.wrist"
        }
    },
    "annotation": {
        "human.task_description": {
            "original_key": "task_index"
        }
    }
}
```

## Finetuning

!!!Warning
    RTX5090の場合、PyTorch2.7.1,Tochvison0.22.1にアップデート

```
pip install torch==2.7.1 torchvision==0.22.1 \
--extra-index-url https://download.pytorch.org/whl/cu128
```

Flash-Attentionもいれなおします。

```
python -m pip uninstall -y flash-attn flash_attn
git clone https://github.com/Dao-AILab/flash-attention.git
cd flash-attention
git checkout v2.8.3
export TORCH_CUDA_ARCH_LIST="12.0"
python -m pip install . --no-build-isolation
```

`scripts/gr00t_finetune.py`　に

```
import warnings
warnings.filterwarnings(
    "ignore",
    message=r".*video decoding and encoding capabilities of torchvision are deprecated.*",
    category=UserWarning,
    module=r"torchvision\.io\._video_deprecation_warning",
)
```

を追加して、Warningがでないようにする

```
cd /workspace/
```

```
python scripts/gr00t_finetune.py \
    --dataset-path ./demo_data/so101-table-cleanup/ \
    --num-gpus 1 \
    --batch-size 32 \
    --output-dir ~/so101-checkpoints  \
    --max-steps 10000 \
    --data-config so100_dualcam \
    --video-backend torchvision_av
```

Finetuningが、RTX5090で、2時間程度かかります。

## Dockerの保存

Dokcer起動元のUbuntuから

```
sudo docker ps -a
```

```
CONTAINER ID   IMAGE         COMMAND                  CREATED          STATUS          PORTS     NAMES
0286150d2dc7   isaac-gr00t   "/opt/nvidia/nvidia_…"   53 minutes ago   Up 53 minutes             tender_knuth
```

CONTRAINER_IDを指定してcommitしておく

```
docker commit 0286150d2dc7 isaac-gr00t
```


## Reference

- [3_0_new_embodiment_finetuning.md](https://github.com/NVIDIA/Isaac-GR00T/blob/main/getting_started/3_0_new_embodiment_finetuning.md)