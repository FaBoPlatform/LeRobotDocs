# 学習

## 1. ACT学習（新規）

5000ステップで動作を確認し、必要に応じて1万〜2万ステップへ増やします。フォームの「Hugging Faceにアップ」はデータセット用です。モデルのHubアップロードは、`policy.repo_id`未指定エラーを避けるため、この例では無効にしています。

すでに学習済みのモデル（`{{TRAIN_OUTPUT_DIR}}`）がある場合、削除せずに日時付きの名前へ変更してバックアップしておきます。

```bash
cd "{{PROJECT_DIR}}"

if [ -d "{{TRAIN_OUTPUT_DIR}}" ]; then
  mv "{{TRAIN_OUTPUT_DIR}}" "{{TRAIN_OUTPUT_DIR}}_backup_$(date +%Y%m%d_%H%M%S)"
fi
```

=== "Jetson"

    完成済みのローカルデータセットとキャッシュ済みResNet18を使用する例です。

    ```bash
    cd "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1
    export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True,max_split_size_mb:128

    lerobot-train \
      --dataset.root={{DATASET_DIR}} \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.video_backend=pyav \
      --policy.type=act \
      --output_dir={{TRAIN_OUTPUT_DIR}} \
      --job_name={{TRAIN_RUN_NAME}} \
      --policy.device=cuda \
      --policy.push_to_hub=false \
      --save_checkpoint_to_hub=false \
      --wandb.enable={{WANDB_ENABLE}} \
      --steps=15000 \
      --save_freq=5000 \
      --batch_size=2 \
      --num_workers=0 \
      --policy.use_amp=true \
      --policy.use_vae=false \
      --policy.chunk_size=50 \
      --policy.n_action_steps=50
    ```

    正常終了時は、最後に概ね次が表示されます。

    ```text
    Checkpoint policy after step 5000
    End of training
    ```

    |STEP数|Dataset|Jetson Orin Nano(学習時間)|
    |:--|:--|:--|
    |5000|10秒x30episode|30分|
    |10000|10秒x30episode|50分|
    |15000|10秒x30episode|1時間10分|

=== "MacBook"

    ```bash
    cd "{{PROJECT_DIR}}"
    export HF_HUB_OFFLINE=1

    lerobot-train \
      --dataset.root={{DATASET_DIR}} \
      --dataset.repo_id={{DATASET_REPO_ID}} \
      --dataset.video_backend=pyav \
      --policy.type=act \
      --output_dir={{TRAIN_OUTPUT_DIR}} \
      --job_name={{TRAIN_RUN_NAME}} \
      --policy.device=mps \
      --policy.push_to_hub=false \
      --save_checkpoint_to_hub=false \
      --wandb.enable={{WANDB_ENABLE}} \
      --steps=15000 \
      --save_freq=5000 \
      --batch_size=2 \
      --num_workers=0 \
      --policy.use_vae=false \
      --policy.chunk_size=50 \
      --policy.n_action_steps=50
    ```

    !!! note
        `'torchcodec' is not available ... falling back to 'pyav'`は、PyAVへ切り替えたことを示す警告です。`--dataset.video_backend=pyav`を明示しているため、学習を停止する致命的エラーではありません。

## 2. 学習の継続

`steps`は追加ステップ数ではなく、継続後に到達させる総ステップ数です。5000ステップから15000ステップまで継続する例です。JSONを手作業で編集せず、CLIで`--steps=15000`を上書きします。

```bash
cd "{{PROJECT_DIR}}"
export HF_HUB_OFFLINE=1

lerobot-train \
  --config_path={{TRAIN_CONFIG_PATH}} \
  --resume=true \
  --steps=15000 \
  --policy.push_to_hub=false \
  --save_checkpoint_to_hub=false \
  --wandb.enable={{WANDB_ENABLE}}
```

## リファレンス

- [SO-101](https://huggingface.co/docs/lerobot/so101)
- [Imitation Learning on Real-World Robots](https://huggingface.co/docs/lerobot/il_robots)
- [Policy Deployment (`lerobot-rollout`)](https://huggingface.co/docs/lerobot/inference)
- [LeRobot v0.6.0 Release](https://github.com/huggingface/lerobot/releases/tag/v0.6.0)
