# OpenMV

MV（音乐影像）创作层：**歌曲优先的流程 + 预设 + skills**，渲染引擎与 OpenCut 完全相同。

OpenMV 不复制播放器、合成器或编码器——画面、混音与 MP4 输出都由 OpenCut
引擎完成。它只提供 MV 领域需要的东西：歌曲解析、分镜脚本、调色板、运镜、
歌词字效、节拍网格，以及给 agent 用的创作 skills。

## 流程：MV 与短片相反

```
AI 短片制作：剧本 → 脚本 → 音乐          （以剧本为基础生成视频）
AI MV 制作：  歌曲 → 音乐结构 → 与歌曲匹配的脚本 → 画面
```

短片从剧本出发，音乐是配乐；MV 从歌曲出发，画面必须服从已经存在的音乐。
因此 OpenMV 的入口是 `analyze`，中间产物是一份**可审阅的分镜脚本**，最后才是
`compile` 与 `render`：

```
song.wav ──analyze──> SongProfile ──planSongMv──> SongMvPlan ──compileSongMv──> Film ──> MP4
                      (BPM/拍偏移/段落/能量)      (镜头/运镜/字效/歌词行)          (OpenCut)
```

脚本是纯数据，可以先打印、改拍点、换运镜，再编译；改音乐结构不需要重写画面代码。

| 层 | 归属 |
| --- | --- |
| 渲染引擎、场景 IR、音效/歌声合成、编码 | OpenCut（`@wae/open-cut`）与本工作区 `media.rs` |
| 歌曲解析、分镜脚本、MV 预设与构造器 | 本仓 `@wae/open-mv` |
| MV 创作方法论 | 本仓 `skills/` |

## 快速开始

```bash
pnpm install
pnpm build
pnpm presets                     # 调色板 / 运镜 / 字效目录
pnpm analyze song.wav            # BPM、拍偏移、段落与能量
pnpm render:song                 # -> song-mv.mp4（24s，歌曲优先流程）
pnpm render:lyric                # -> lyric-mv.mp4（12.5s，歌词行直编）
pnpm render:beat                 # -> beat-mv.mp4（8s，逐拍卡点）
```

本地开发时 `@wae/open-cut` 通过 `link:` 指向同工作区的 OpenCut 检出，因此需要：

1. 相邻目录存在 `OpenCut` 检出；
2. OpenCut 的 `packages/open-cut` 已构建（`pnpm build:ts`）；
3. OpenCut 的原生绑定已构建并 staged（`pnpm build:napi`）。

发布到 npm 时把 `link:` 换成版本号即可，代码无需改动。

## 歌曲 → 脚本 → 成片

```ts
import { analyzeWav, planSongMv, compileSongMv } from '@wae/open-mv';

const song = analyzeWav('song.wav');          // 1. 歌曲事实
const plan = planSongMv({                      // 2. 分镜脚本（可打印/审阅）
    song,
    palette: 'dusk-film',
    lines: ['把名字写进旧档案', '我在副歌里重写一遍'],
});
console.log(JSON.stringify(plan, null, 2));    //    脚本是纯数据
export default compileSongMv(plan, { grain: 0.05 }); // 3. 编译成 Film
```

渲染：`open-mv render films/song-mv.ts -o out.mp4`。

脚本规则（固定、可预测）：

- 每个歌曲段落一个镜头；镜头运镜按段落类型与能量选：副歌高能 `rise`、副歌 `settle`、
  首尾 `pull-out`、主歌 `push-in` / `drift-left` 交替。
- 字效同样按段落：副歌 `lyric-glow`（能量 ≥ 0.85 用 `lyric-big`）、首尾 `caption`、
  主歌用默认值。
- 歌词行按镜头时长比例分配（最大余数法），可对单行覆盖字效。
- 卡点：每小节一个 `tick`，每个副歌起点一个 `impact`、前一拍一个 `riser`。

不想先解析歌曲时，`lyricMv({ lines, tempoBpm, ... })` 仍是“歌词直编”快捷路径。

## 歌曲解析的合同

- 只接受 **PCM WAV**（16/24 bit 整数或 32 bit 浮点）。其他容器先转 WAV，
  不做隐式解码、不猜采样率；格式不符直接报错。
- 算法全确定性：短时能量 → 起音强度 → 自相关测速（抛物线插值）→ 拍相位 →
  按最响 10% 帧的小节能量分段。没有随机、没有训练模型。
- 段落类型由能量与位置判定，是**辅助判断而不是事实**：脚本是数据，跑完
  `analyze` 后应按听感修正段落边界或类型，再编译。
- 边界按小节对齐，跨段落的半小节会被归到能量更接近的一侧；短于两小节的首尾
  段落会保留（短前奏/尾奏是真实的），内部碎段会并回邻居。

## 预设与 skills

- 预设：`PALETTES`（6 套）、`CAMERA_MOVES`（6 种）、`TEXT_STYLES`（5 种），
  以及 `beatGrid` / `lyricMv` / `divider`。id 是稳定合同。
- skills：`skills/open-mv-song`（歌曲解析与脚本）、`skills/open-mv-director`
  （整体气质与能量曲线）、`skills/open-mv-lyric`（歌词排期与字效）、
  `skills/open-mv-beat`（卡点与音效落点）。
- 目录细节见 `skills/open-mv-director/references/presets.md`。

## 当前边界

- 场景之间是硬切；引擎没有转场与多轨合成。
- 合成歌声只有 5 个元音 × 7 类起音，不能逐字唱任意歌词；真实人声请导入音频并
  声明为外部素材。
- 歌曲解析只给结构初稿，不承诺对任意风格都准确；不分析调性、和弦与音色。
- 不含素材库；图片/视频需要自行提供路径。
- 验收依赖实际渲染抽查（`ffmpeg -af volumedetect` + 抽帧），不以「能出文件」代替成片。

## 示例

- `films/song-mv.ts` — 歌曲优先：歌曲结构 → 分镜脚本 → 成片（24s）。
- `films/lyric-mv.ts` — 歌词直编：1 个片头 + 4 行歌词，合成歌声与卡点。
- `films/beat-mv.ts` — 卡点：4 小节，每拍 tick、小节头 impact、收尾 riser。

## 许可证

Apache-2.0，见 [License.md](License.md)。
