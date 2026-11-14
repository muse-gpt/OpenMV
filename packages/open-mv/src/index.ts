/**
 * `@wae/open-mv` — MV authoring layer: preset catalogue plus beat and lyric
 * builders.
 *
 * The engine and authoring primitives come from OpenCut; this package only adds
 * MV-domain pieces: palettes, camera moves, lyric styles, beat grids, lyric
 * compilers and authoring skills. Every export is an independent small function
 * or plain data; the CLI is a thin shell over them.
 */
export {
    CAMERA_MOVES,
    PALETTES,
    TEXT_STYLES,
    cameraById,
    paletteBackground,
    paletteById,
    paletteColor,
    paletteDesign,
    textStyleById,
} from './presets.js';
export type { MvCamera, MvPalette, MvTextStyle } from './presets.js';

export { beatGrid, divider, lyricMv } from './mv.js';
export type { BeatGrid, LyricLineInput, LyricMvOptions, LyricVoiceInput } from './mv.js';

export { analyzeWav } from './song.js';
export type { SectionKind, SongProfile, SongSection } from './song.js';

export { compileSongMv, planGrid, planSongMv } from './plan.js';
export type { CompileOptions, SongLineInput, SongMvOptions, SongMvPlan, SongShot } from './plan.js';
