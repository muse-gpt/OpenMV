# OpenMV 预设目录

`open-mv presets` 打印同一份数据；`open-mv presets --json` 输出机器可读版本。
id 是稳定合同，重命名属于破坏性变更。

## 调色板

| id | 气质 | 背景 | 主字色 | 强调色 |
| --- | --- | --- | --- | --- |
| `neon-night` | 夜、霓虹、克制 | 纵向渐变 深蓝黑 | `#e9f0fb` | `#7aa2ff` |
| `dusk-film` | 暮色、胶片、暖 | 纵向渐变 棕黑 | `#f6ead8` | `#d9a066` |
| `mono-ink` | 极简、墨白 | 纯黑 | `#f2f2f2` | `#b9bcc2` |
| `cyber-lime` | 赛博、电子 | 径向 深绿 | `#eafff2` | `#6fd6a4` |
| `sakura` | 夜樱、柔和 | 纵向渐变 紫棕 | `#ffeef6` | `#f2a6c8` |
| `starfield` | 星野、开阔 | 星点背景 | `#eaf1ff` | `#9db8ff` |

## 运镜

| id | 运动 | 缩放 | 缓动 | 适用 |
| --- | --- | --- | --- | --- |
| `push-in` | 缓推 | 1.00→1.08 | in-out-cubic | 主歌、叙述 |
| `pull-out` | 缓拉 | 1.10→1.00 | out-cubic | 收尾、留白 |
| `drift-left` | 左移 | 1.06→1.04 | in-out-sine | 并列画面、行进感 |
| `drift-right` | 右移 | 1.06→1.04 | in-out-sine | 与左移交替 |
| `rise` | 上摇 | 1.02→1.10 | in-out-quart | 副歌上扬 |
| `settle` | 落定 | 1.14→1.00 | out-quint | 段落开头砸下 |

## 字效

| id | 字号 | 颜色角色 | 辉光 | 适用 |
| --- | --- | --- | --- | --- |
| `lyric-clean` | 46 | ink | 否 | 主歌歌词 |
| `lyric-glow` | 52 | ink | 是 | 副歌歌词 |
| `lyric-big` | 76 | hot | 否 | 点睛句 |
| `caption` | 26 | dim | 否 | 署名、说明 |
| `title-stack` | 92 | ink | 是 | 片头标题 |

颜色角色在渲染时从所选调色板取色，因此字效与调色板可以自由组合。
