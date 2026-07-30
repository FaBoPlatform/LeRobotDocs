# Dataset

## LeRobotのデータセットフォーマット

|名称|Version|LeRobot対応バージョン|
|:--|:--|:--|
|LeRobotDataset|v3.0|LeRobot 0.4.0<br>LeRobot 0.5.0<br>LeRobot 0.6.0|


## 各種データフォーマット

|項目|フォーマット|特徴|
|:--|:--|:--|
|数値データ|Apache Parquet|観測状態（joint角度、力、センサ値など, 行動（アクション）, タイムスタンプ|
|カメラ|MP4|1ファイルに複数エピソード分のフレームを連結|
|メタデータ|JSON|正規化統計量やタスク、カメラFPS、FPS情報|

## フォーマット例

```
dataset/
├── meta/
│   ├── info.json        # スキーマ・FPS・パス定義
│   ├── stats.json       # 正規化用統計
│   ├── tasks.jsonl      # タスク文 → ID
│   └── episodes/        # 各エピソードの開始/終了オフセット
├── data/                # Parquet（数値データ、複数エピソード混在）
└── videos/              # MP4（カメラ別、複数エピソード混在）
```

## Reference

- [LeRobot Dataset V3.0](https://huggingface.co/docs/lerobot/lerobot-dataset-v3)