/**
 * `@wae/open-mv` — MV 创作层：预设目录 + 节拍/歌词构造器。
 *
 * 引擎与作者面来自 OpenCut（与 `MIT/Apache` 同源的上游包），本包只增加
 * MV 领域的东西：调色板、运镜、字效、节拍网格、歌词行编译器与创作 skills。
 * 每个导出都是独立小函数或纯数据，CLI 只是它们的薄壳。
 */
export {
    CAMERA_MOVES,
    PALETTES,
    TEXT_STYLES,
    cameraById,
    paletteById,
    paletteColor,
    textStyleById,
} from './presets.js';
export type { MvCamera, MvPalette, MvTextStyle } from './presets.js';

export { beatGrid, divider, lyricMv } from './mv.js';
export type { BeatGrid, LyricLineInput, LyricMvOptions, LyricVoiceInput } from './mv.js';

export { analyzeWav } from './song.js';
export type { SectionKind, SongProfile, SongSection } from './song.js';

export { compileSongMv, planGrid, planSongMv } from './plan.js';
export type { CompileOptions, SongLineInput, SongMvOptions, SongMvPlan, SongShot } from './plan.js';
