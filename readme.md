# OpenMV

MV（音乐影像）创作层：**预设 + skills**，渲染引擎与 OpenCut 完全相同。

OpenMV 不复制播放器、合成器或编码器——画面、混音与 MP4 输出都由 OpenCut
引擎完成。它只提供 MV 领域需要的东西：调色板、运镜、歌词字效、节拍网格、
歌词行编译器，以及给 agent 用的创作 skills。

| 层 | 归属 |
| --- | --- |
| 渲染引擎、场景 IR、音效/歌声合成、编码 | OpenCut（`@wae/open-cut`）与本工作区 `media.rs` |
| MV 调色板、运镜、字效、节拍网格、歌词编译器 | 本仓 `@wae/open-mv` |
| MV 创作方法论 | 本仓 `skills/` |

## 快速开始

```bash
pnpm install
pnpm build
pnpm presets                 # 列出调色板 / 运镜 / 字效
pnpm render:lyric            # -> lyric-mv.mp4（12.5s，含合成歌声）
pnpm render:beat             # -> beat-mv.mp4（8s，逐拍卡点）
```

本地开发时 `@wae/open-cut` 通过 `link:` 指向同工作区的 OpenCut 检出，因此需要：

1. 相邻目录存在 `OpenCut` 检出；
2. OpenCut 的 `packages/open-cut` 已构建（`pnpm build:ts`）；
3. OpenCut 的原生绑定已构建并 staged（`pnpm build:napi`）。

发布到 npm 时把 `link:` 换成版本号即可，代码无需改动。

## 写一条 MV

歌词 MV 只需要歌词、BPM 和预设 id：

```ts
import { lyricMv } from '@wae/open-mv';

export default lyricMv({
    width: 1280,
    height: 720,
    fps: 30,
    tempoBpm: 96,
    palette: 'starfield',      // 调色板 id
    camera: 'push-in',         // 运镜 id
    title: '夜行',
    textStyle: 'lyric-glow',   // 字效 id
    hits: true,                // 每行开头一个卡点音效
    lines: [
        { text: '把夜色折成一条街', beats: 4 },
        { text: '我在节拍里转身', beats: 4, style: 'lyric-big' },
    ],
    voice: {
        syllables: [{ onset: 'r', vowel: 'a', pitch: 293.66, beats: 2 }],
    },
});
```

渲染：

```bash
open-mv render films/lyric-mv.ts -o out.mp4
```

卡点 MV 用手写 Film + `beatGrid`，所有拍→秒换算只有一个来源：

```ts
import { Film, shape } from '@wae/open-cut';
import { beatGrid } from '@wae/open-mv';

const grid = beatGrid(120, 30);
new Film({ width: 1280, height: 720, fps: 30 })
    .scene({ duration: grid.barSeconds, items: [shape({ shape: 'ring', x: 0.5, y: 0.5, w: 0.2, h: 0.2, color: '#7aa2ff' })] })
    .audio({ bgm: { volume: 0.08 }, sfx: [{ at: grid.secondsOf(4), kind: 'impact', volume: 0.3 }] });
```

## 预设与 skills

- 预设：`PALETTES`（6 套）、`CAMERA_MOVES`（6 种）、`TEXT_STYLES`（5 种），
  以及 `beatGrid` / `lyricMv` / `divider`。id 是稳定合同。
- skills：`skills/open-mv-director`（整体气质与能量曲线）、`skills/open-mv-lyric`
  （歌词排期与字效）、`skills/open-mv-beat`（卡点与音效落点）。
- 目录细节见 `skills/open-mv-director/references/presets.md`。

## 当前边界

- 场景之间是硬切；引擎没有转场与多轨合成。
- 合成歌声只有 5 个元音 × 7 类起音，不能逐字唱任意歌词；真实人声请导入音频并
  声明为外部素材。
- 不含素材库；图片/视频需要自行提供路径。
- 音质与卡点验收依赖实际渲染抽查（`ffmpeg -af volumedetect` + 抽帧），不以
  「能出文件」代替成片。

## 示例

- `films/lyric-mv.ts` — 歌词 MV，1 个片头 + 4 行歌词，星野调色、合成歌声、卡点音效。
- `films/beat-mv.ts` — 卡点 MV，4 小节，每拍 tick、小节头 impact、收尾 riser。

## 许可证

Apache-2.0，见 [License.md](License.md)。
