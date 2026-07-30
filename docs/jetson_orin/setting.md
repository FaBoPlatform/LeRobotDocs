# Jetson環境構築

## 環境構築Script

[https://github.com/FaBoPlatform/Jetson_script/blob/main/lerobot/orin_nano/6.2/install.sh](https://github.com/FaBoPlatform/Jetson_script/blob/main/lerobot/orin_nano/6.2/install.sh)

install.shの名前で保存して

```
chmod 755 ./install.sh
```

## 実行

```
./install.sh
```

rebootして、再起動したら

```
conda activate lerobot
```

する。この処理は毎回実施。


## 日本語対応


```
sudo apt-get install language-pack-ja language-pack-ja-base

# 2) /etc/locale.gen で ja_JP.UTF-8 の行をアンコメント
sudo sed -i '/^# *ja_JP.UTF-8 /s/^# *//' /etc/locale.gen

# 3) 実際にロケールファイルを生成
sudo locale-gen

export LANG=ja_JP.UTF-8
```