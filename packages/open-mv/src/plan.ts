/**
 * MV 脚本层：歌曲结构 → 分镜脚本 → Film。
 *
 * 这是 OpenMV 与短片流程的分界：短片从剧本出发，MV 从**歌曲**出发。这里
 * 只做两件可检查的事：
 * 1. {@link planSongMv} 把 `SongProfile` 翻成一份可序列化、可审阅的分镜脚本；
 * 2. {@link compileSongMv} 把脚本编译成 OpenCut 的 Film。
 *
 * 脚本与编译分开，是为了让「与歌曲匹配的短片脚本」成为可复核的产物：改脚本
 * 不必重听整首歌，改歌曲结构也不必重写画面代码。
 */
import { Film, glow, grain, text } from '@wae/open-cut';
import type { ItemInput } from '@wae/open-cut';

import { cameraById, paletteById, paletteColor, textStyleById } from './presets.js';
import { beatGrid } from './mv.js';
import type { BeatGrid } from './mv.js';
import type { SongProfile, SongSection } from './song.js';
import type { LyricVoiceInput } from './mv.js';

export interface SongLineInput {
    text: string;
    /** 覆盖该行的字效 id。 */
    style?: string;
}

/** 一个镜头：一段歌曲结构 + 它承载的歌词行。 */
export interface SongShot {
    index: number;
    section: SongSection;
    start: number;
    end: number;
    palette: string;
    camera: string;
    textStyle: string;
    lines: SongLineInput[];
}

/** 可序列化的分镜脚本：审阅这一份就够了。 */
export interface SongMvPlan {
    song: SongProfile;
    fps: number;
    width: number;
    height: number;
    palette: string;
    /** `auto` 表示按段落类型与能量自动选运镜。 */
    camera: string;
    textStyle: string;
    shots: SongShot[];
}

export interface SongMvOptions {
    song: SongProfile;
    /** 歌词行；按顺序按镜头时长比例分配。 */
    lines?: Array<string | SongLineInput>;
    palette?: string;
    /** 固定运镜 id；缺省 `auto`。 */
    camera?: string;
    textStyle?: string;
    fps?: number;
    width?: number;
    height?: number;
}

/** 把歌曲结构编排成 MV 分镜脚本（不做渲染）。 */
export function planSongMv(options: SongMvOptions): SongMvPlan {
    const fps = options.fps ?? 30;
    const palette = paletteById(options.palette ?? 'neon-night');
    const textStyle = options.textStyle ?? 'lyric-clean';
    textStyleById(textStyle);
    if (options.song.sections.length === 0) {
        throw new Error('planSongMv: the song profile has no sections');
    }

    const lines: SongLineInput[] = (options.lines ?? []).map((line) =>
        typeof line === 'string' ? { text: line } : { text: line.text, style: line.style },
    );
    const sections = options.song.sections;
    const counts = allocate(lines.length, sections.map((section) => Math.max(0.5, section.end - section.start)));

    let cursor = 0;
    const shots: SongShot[] = sections.map((section, index) => {
        const count = counts[index] ?? 0;
        const assigned = lines.slice(cursor, cursor + count);
        cursor += count;
        const style = textStyleFor(section, textStyle);
        return {
            index,
            section,
            start: section.start,
            end: section.end,
            palette: palette.id,
            camera: options.camera ?? cameraFor(section, index),
            textStyle: style,
            lines: assigned,
        };
    });

    return {
        song: options.song,
        fps,
        width: options.width ?? 1920,
        height: options.height ?? 1080,
        palette: palette.id,
        camera: options.camera ?? 'auto',
        textStyle,
        shots,
    };
}

export interface CompileOptions {
    /** 颗粒强度，0 关闭（默认 0.06）。 */
    grain?: number;
    /** 小节头与副歌起点放卡点音效（默认开）。 */
    hits?: boolean;
    /** BGM 音量；`null` 关闭（默认 0.1）。 */
    bgm?: number | null;
    voice?: LyricVoiceInput | null;
}

/** 把脚本编译成 Film；画面、混音与编码交给 OpenCut 引擎。 */
export function compileSongMv(plan: SongMvPlan, options: CompileOptions = {}): Film {
    const palette = paletteById(plan.palette);
    const grid = beatGrid(plan.song.bpm, plan.fps);
    const grainStrength = options.grain ?? 0.06;
    const film = new Film({ width: plan.width, height: plan.height, fps: plan.fps });

    for (const shot of plan.shots) {
        const duration = Math.max(0.2, shot.end - shot.start);
        const style = textStyleById(shot.textStyle);
        const lineDuration = shot.lines.length > 0 ? duration / shot.lines.length : duration;
        const items: ItemInput[] = [];
        if (style.glow) {
            items.push(glow({ at: 0, dur: duration, x: 0.5, y: 0.5, radius: 0.36, color: palette.glow, intensity: 0.4 }));
        }
        shot.lines.forEach((line, index) => {
            const styleOfLine = line.style ? textStyleById(line.style) : style;
            items.push(
                text({
                    at: index * lineDuration,
                    dur: lineDuration,
                    content: line.text,
                    y: 0.5,
                    size: styleOfLine.size,
                    bold: styleOfLine.bold,
                    color: paletteColor(palette, styleOfLine.color),
                    align: styleOfLine.align ?? 'center',
                    rise: styleOfLine.rise ?? 0,
                    stagger: styleOfLine.stagger ?? 1,
                    glow: styleOfLine.glow ? palette.glow : undefined,
                }),
            );
        });
        if (grainStrength > 0) {
            items.push(grain({ at: 0, dur: duration, strength: grainStrength, density: 14000 }));
        }
        film.scene({
            duration,
            background: palette.background,
            camera: cameraOf(shot.camera),
            items,
        });
    }

    const sfx: Array<{ at: number; kind: 'tick' | 'impact' | 'riser'; volume: number }> = [];
    if (options.hits ?? true) {
        const barSeconds = grid.barSeconds;
        const bars = Math.floor(plan.song.durationSeconds / barSeconds);
        for (let bar = 0; bar < bars; bar++) {
            sfx.push({ at: bar * barSeconds, kind: 'tick', volume: 0.1 });
        }
        for (const shot of plan.shots) {
            if (shot.section.kind === 'chorus') {
                sfx.push({ at: shot.section.start, kind: 'impact', volume: 0.3 });
                if (shot.section.start > barSeconds) {
                    sfx.push({ at: shot.section.start - barSeconds, kind: 'riser', volume: 0.2 });
                }
            }
        }
    }

    const voice = options.voice;
    film.audio({
        bgm: options.bgm === null ? null : { volume: options.bgm ?? 0.1 },
        sfx,
        ...(voice
            ? {
                  voice: [
                      {
                          at: voice.at ?? 0,
                          volume: voice.volume ?? 0.9,
                          song: {
                              tempoBpm: plan.song.bpm,
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

/** 按权重把 `total` 行分配到各镜头（最大余数法，顺序稳定）。 */
function allocate(total: number, weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (total === 0 || sum === 0) {
        return weights.map(() => 0);
    }
    const exact = weights.map((weight) => (total * weight) / sum);
    const counts = exact.map((value) => Math.floor(value));
    let remainder = total - counts.reduce((a, b) => a + b, 0);
    const order = exact
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction);
    for (const entry of order) {
        if (remainder <= 0) {
            break;
        }
        counts[entry.index] = (counts[entry.index] ?? 0) + 1;
        remainder--;
    }
    return counts;
}

function cameraFor(section: SongSection, index: number): string {
    if (section.kind === 'chorus') {
        return section.energy >= 0.85 ? 'rise' : 'settle';
    }
    if (section.kind === 'intro' || section.kind === 'outro') {
        return 'pull-out';
    }
    return index % 2 === 0 ? 'push-in' : 'drift-left';
}

function textStyleFor(section: SongSection, fallback: string): string {
    if (section.kind === 'chorus') {
        return section.energy >= 0.85 ? 'lyric-big' : 'lyric-glow';
    }
    if (section.kind === 'intro' || section.kind === 'outro') {
        return 'caption';
    }
    return fallback;
}

function cameraOf(id: string) {
    const camera = cameraById(id);
    return {
        zoomFrom: camera.zoomFrom,
        zoomTo: camera.zoomTo,
        focusFrom: camera.focusFrom,
        focusTo: camera.focusTo,
        ease: camera.ease,
    };
}

/** 供调用方核对：脚本里实际使用的节拍网格。 */
export function planGrid(plan: SongMvPlan): BeatGrid {
    return beatGrid(plan.song.bpm, plan.fps);
}
