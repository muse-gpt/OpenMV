/**
 * MV 构造器：把「歌词行 + 节拍」编译成 OpenCut 的 Film。
 *
 * 这里不实现渲染，也不复制引擎：画面、混音与编码全部由 OpenCut 的能力面
 * 完成，本层只负责把 MV 领域的作者意图（歌词、拍号、调色板、运镜、字效）
 * 落成场景与音轨。时间在作者层一律用秒与拍，帧换算由 {@link beatGrid}
 * 与引擎统一完成。
 */
import { Film, colorToken, glow, grain, shape, text } from '@wae/open-cut';
import type { Onset, Vowel } from '@wae/open-cut';

import { cameraById, paletteBackground, paletteById, paletteDesign, textStyleById } from './presets.js';
import type { MvCamera, MvPalette, MvTextStyle } from './presets.js';

/** 节拍网格：BPM 与帧率之间的唯一换算所有者。 */
export interface BeatGrid {
    fps: number;
    bpm: number;
    beatSeconds: number;
    beatFrames: number;
    barSeconds: number;
    barFrames: number;
    secondsOf(beats: number): number;
    framesOf(beats: number): number;
}

/** 由 BPM 与帧率建立节拍网格（4/4 拍，一小节 4 拍）。 */
export function beatGrid(bpm: number, fps: number): BeatGrid {
    if (!Number.isFinite(bpm) || bpm <= 0) {
        throw new Error(`beatGrid: bpm must be positive, got ${bpm}`);
    }
    if (!Number.isInteger(fps) || fps <= 0) {
        throw new Error(`beatGrid: fps must be a positive integer, got ${fps}`);
    }
    const beatSeconds = 60 / bpm;
    return {
        fps,
        bpm,
        beatSeconds,
        beatFrames: beatSeconds * fps,
        barSeconds: beatSeconds * 4,
        barFrames: beatSeconds * 4 * fps,
        secondsOf: (beats) => beats * beatSeconds,
        framesOf: (beats) => Math.round(beats * beatSeconds * fps),
    };
}

/** 一行歌词。 */
export interface LyricLineInput {
    text: string;
    /** 这一行占几拍（默认 4 拍 = 一小节）。 */
    beats?: number;
    /** 这一行的字效 id（覆盖整片默认字效）。 */
    style?: string;
}

/** 一段合成歌声（`media.voice` 合同，5 元音 × 7 起音类）。 */
export interface LyricVoiceInput {
    syllables: Array<{ onset?: Onset; vowel: Vowel; pitch: number; beats: number }>;
    /** 起唱秒数；缺省与第一行歌词同时开始。 */
    at?: number;
    volume?: number;
    breath?: number;
    seed?: number;
}

/** MV 构造选项。 */
export interface LyricMvOptions {
    lines: LyricLineInput[];
    /** 曲速，默认 100 BPM。 */
    tempoBpm?: number;
    fps?: number;
    width?: number;
    height?: number;
    /** 调色板 id，默认 `neon-night`。 */
    palette?: string;
    /** 运镜 id，默认 `push-in`。 */
    camera?: string;
    /** 片头标题（占 `titleBeats` 拍）。 */
    title?: string;
    titleBeats?: number;
    /** 全片默认字效 id，默认 `lyric-clean`。 */
    textStyle?: string;
    /** BGM 音量；`null` 关闭。 */
    bgm?: number | null;
    /** 每个歌词行起点放一个卡点音效。 */
    hits?: boolean;
    /** 合成歌声；缺省则只有画面与 BGM。 */
    voice?: LyricVoiceInput | null;
    /** 铺一条鼓组节奏型（预设名），按 `tempoBpm` 铺满全片。 */
    drums?: string | null;
    /** 颗粒强度，0 关闭。 */
    grain?: number;
}

/**
 * 把歌词行编译为一条 MV。
 *
 * 每一行是一个场景，时长按拍数换算；字效、调色板与运镜都来自预设目录。
 * 未知的预设 id、空歌词或非法 BPM 会显式抛错，不做静默回退。
 */
export function lyricMv(options: LyricMvOptions): Film {
    if (options.lines.length === 0) {
        throw new Error('lyricMv: at least one lyric line is required');
    }
    const fps = options.fps ?? 30;
    const bpm = options.tempoBpm ?? 100;
    const grid = beatGrid(bpm, fps);
    const palette = paletteById(options.palette ?? 'neon-night');
    const camera = cameraById(options.camera ?? 'push-in');
    const defaultStyle = textStyleById(options.textStyle ?? 'lyric-clean');
    const grainStrength = options.grain ?? 0.06;

    const film = new Film({ width: options.width ?? 1920, height: options.height ?? 1080, fps }).design(paletteDesign(palette));
    let cursor = 0;
    const lineStarts: number[] = [];

    if (options.title) {
        const duration = grid.secondsOf(options.titleBeats ?? 4);
        film.scene({
            duration,
            background: paletteBackground(palette),
            camera: cameraOf(camera),
            items: [
                glow({ at: 0, dur: duration, x: 0.5, y: 0.46, radius: 0.4, color: colorToken('glow'), intensity: 0.5 }),
                titleText(options.title, duration, textStyleById('title-stack')),
                ...(grainStrength > 0 ? [grain({ at: 0, dur: duration, strength: grainStrength, density: 14000 })] : []),
            ],
        });
        cursor += duration;
    }

    for (const line of options.lines) {
        const style = line.style ? textStyleById(line.style) : defaultStyle;
        const duration = Math.max(0.35, grid.secondsOf(line.beats ?? 4));
        lineStarts.push(cursor);
        film.scene({
            duration,
            background: paletteBackground(palette),
            camera: cameraOf(camera),
            items: [
                ...(style.glow
                    ? [glow({ at: 0, dur: duration, x: 0.5, y: 0.5, radius: 0.36, color: colorToken('glow'), intensity: 0.4 })]
                    : []),
                text({
                    at: 0,
                    dur: duration,
                    content: line.text,
                    y: 0.5,
                    size: style.size,
                    bold: style.bold,
                    color: colorToken(style.color),
                    align: style.align ?? 'center',
                    rise: style.rise ?? 0,
                    stagger: style.stagger ?? 1,
                    glow: style.glow ? colorToken('glow') : undefined,
                }),
                ...(grainStrength > 0 ? [grain({ at: 0, dur: duration, strength: grainStrength, density: 14000 })] : []),
            ],
        });
        cursor += duration;
    }

    const sfx: Array<{ at: number; kind: 'tick' | 'impact'; volume: number }> = options.hits
        ? lineStarts.map((at) => ({ at, kind: 'tick' as const, volume: 0.16 }))
        : [];
    if (options.title) {
        sfx.push({ at: 0, kind: 'impact' as const, volume: 0.4 });
    }
    const voice = options.voice;
    const drums = options.drums;
    film.audio({
        bgm: options.bgm === null ? null : { volume: options.bgm ?? 0.12 },
        sfx,
        ...(drums
            ? {
                  patterns: [
                      {
                          at: 0,
                          preset: drums,
                          bpm,
                          bars: Math.min(32, Math.max(1, Math.ceil(cursor / grid.barSeconds))),
                          volume: 0.7,
                      },
                  ],
              }
            : {}),
        ...(voice
            ? {
                  voice: [
                      {
                          at: voice.at ?? lineStarts[0] ?? 0,
                          volume: voice.volume ?? 0.9,
                          song: {
                              tempoBpm: bpm,
                              breath: voice.breath ?? 0.08,
                              seed: voice.seed ?? 1,
                              syllables: voice.syllables,
                          },
                      },
                  ],
              }
            : {}),
    });

    return film;
}

function cameraOf(camera: MvCamera) {
    return {
        zoomFrom: camera.zoomFrom,
        zoomTo: camera.zoomTo,
        focusFrom: camera.focusFrom,
        focusTo: camera.focusTo,
        ease: camera.ease,
    };
}

function titleText(title: string, duration: number, style: MvTextStyle) {
    return text({
        at: 0,
        dur: duration,
        content: title,
        y: 0.46,
        size: style.size,
        bold: style.bold,
        color: colorToken(style.color),
        rise: style.rise ?? 0,
        stagger: style.stagger ?? 1,
        glow: style.glow ? colorToken('glow') : undefined,
    });
}

/** 一条水平装饰线，用于歌词段落之间的留白。 */
export function divider(options: { at: number; dur: number; y?: number; color: string; width?: number }) {
    return shape({
        at: options.at,
        dur: options.dur,
        shape: 'line',
        x: 0.5,
        y: options.y ?? 0.62,
        w: options.width ?? 0.28,
        h: 0.01,
        color: options.color,
        stroke: 2,
    });
}
