# Jetsonの各種設定

## WiFiの接続

```
ifconfig
```

```
sudo nmcli device wifi connect SSID password パスワード
```

## Power modeの確認

```
sudo nvpmodel -q
```

|id|Mode|
|:--|:--|
|0|15W|
|1|25W|
|2|MAX|

MAXモード(Super Mode)に設定する

```
sudo nvpmodel -m 2
```

## JetPackのバージョン確認

```
cat /etc/nv_tegra_release
```

JetPack6.2.1の場合は、

```
# R36 (release), REVISION: 4.4, GCID: 41062509, BOARD: generic, EABI: aarch64, DATE: Mon Jun 16 16:07:13 UTC 2025
```

|項目|意味|
|:--|:--|
|R36 |JetPack 6 系（Jetson Linux R36 系）|
|REVISION: 4.4 | Jetson Linux R36.4.4 |
|BOARD: generic |Orin DevKit|
|EABI: aarch64 |64bit ARM|
|DATE: Mon Jun 16 2025|JetPack 6.2.1 のリリース日 |
