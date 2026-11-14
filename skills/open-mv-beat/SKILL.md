---
name: open-mv-beat
description: 卡点与音效落点。需要按 BPM 把鼓组、重音、转场音效放到拍上，或用 beatGrid 写卡点 MV 时使用。
---

# 卡点工作流

## 何时使用

- 有 BPM 与段落结构，需要把 impact / tick / riser / whoosh 放到正确的拍。
- 要手写卡点 MV（环、条带、逐拍文字）而不是歌词 MV。

歌词排期 → `open-mv-lyric`；整体气质 → `open-mv-director`。

## 节拍合同

- 唯一换算入口是 `beatGrid(bpm, fps)`，返回 `beatSeconds` / `barSeconds` 与 `secondsOf(beats)` / `framesOf(beats)`。不要在业务代码里再写 `60 / bpm`。
- 音效的 `at` 在 `film.audio()` 里是**秒**；场景与图元的时间也是秒；只有导出 JSON 时才是帧。
- 同一种音效在同一 spec 下任意位置声音字节一致；不要指望放置位置改变音色。要变化就换 `pitch` / `brightness` / `preset`。
- 随机种子缺省为 1，同 spec + seed 逐字节复现。

## 工作流

1. 有歌曲文件时先 `open-mv analyze` 拿 BPM 与 `beatOffsetSeconds`：第一拍通常不在 0 秒，
   所有卡点都要加上这个偏移。没有文件时用 `beatGrid` 打印关键时间点核对。
2. 密度分层：小节头 `impact`、拍点 `tick`、段落前 `riser`、画面切换 `whoosh`。同一拍不要超过两层。
3. 音量：卡点 `0.10–0.30`，段落头 `0.25–0.45`，riser 提前 1–2 小节进场。
4. 逐拍 tick 时给 `pitch` 轻微递变（如 1.0→1.3）制造推进感，但不要超出参数范围（pitch ≥ 0.05）。
5. 渲染后抽查：重音与画面变化同帧，没有明显滞后；整片峰值不超过 0 dBFS（`ffmpeg -af volumedetect` 检查 max_volume）。

## 硬约束

- 不要用很多小音效堆出「热闹」，密度过高会掩盖歌声与人声。
- 未知 family / preset、同时给出 `kind` 与 `preset`、越界参数都是显式错误，不允许静默回退。
- 不要为了卡点把 BPM 硬改成整数拍；以实际音频为准。
- 无外部音频文件时整片仍有 BGM 与合成音效，不要声称用了真实鼓组。
