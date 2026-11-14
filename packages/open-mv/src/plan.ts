/**
 * MV script layer: song structure → storyboard script → Film.
 *
 * This is where the MV flow diverges from a short film: a short film starts
 * from a script, an MV starts from the song. Only two checkable steps happen
 * here:
 * 1. {@link planSongMv} turns a `SongProfile` into a serializable, reviewable
 *    storyboard script;
 * 2. {@link compileSongMv} compiles that script into an OpenCut Film.
 *
 * Script and compilation are separate so the script becomes a reviewable
 * artifact: reviewing it does not require re-listening to the song, and a song
 * structure change does not require rewriting picture code.
 */
import { Film, colorToken, glow, grain, text } from '@wae/open-cut';
import type { ItemInput } from '@wae/open-cut';

import { cameraById, paletteBackground, paletteById, paletteDesign, textStyleById } from './presets.js';
import { beatGrid } from './mv.js';
import type { BeatGrid } from './mv.js';
import type { SongProfile, SongSection } from './song.js';
import type { LyricVoiceInput } from './mv.js';

export interface SongLineInput {
    text: string;
    /** Lyric-style id overriding this line. */
    style?: string;
}

/** One shot: a song section plus the lyric lines it carries. */
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

/** A serializable storyboard script: reviewing this one object is enough. */
export interface SongMvPlan {
    song: SongProfile;
    fps: number;
    width: number;
    height: number;
    palette: string;
    /** `auto` selects a camera move from section kind and energy. */
    camera: string;
    textStyle: string;
    shots: SongShot[];
}

export interface SongMvOptions {
    song: SongProfile;
    /** Lyric lines, distributed across shots in proportion to duration. */
    lines?: Array<string | SongLineInput>;
    palette?: string;
    /** Fixed camera-move id; defaults to `auto`. */
    camera?: string;
    textStyle?: string;
    fps?: number;
    width?: number;
    height?: number;
}

/** Arranges song structure into an MV storyboard script (no rendering). */
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
    /** Grain strength, 0 disables it (default 0.06). */
    grain?: number;
    /** Place hit sounds at bar starts and chorus entries (default on). */
    hits?: boolean;
    /** BGM volume; `null` disables it (default 0.1). */
    bgm?: number | null;
    /** Fill the film with a drum-groove preset at the song BPM. */
    drums?: string | null;
    voice?: LyricVoiceInput | null;
}

/** Compiles the script into a Film; picture, mixing and encoding belong to the OpenCut engine. */
export function compileSongMv(plan: SongMvPlan, options: CompileOptions = {}): Film {
    const palette = paletteById(plan.palette);
    const grid = beatGrid(plan.song.bpm, plan.fps);
    const grainStrength = options.grain ?? 0.06;
    const film = new Film({ width: plan.width, height: plan.height, fps: plan.fps }).design(paletteDesign(palette));

    for (const shot of plan.shots) {
        const duration = Math.max(0.2, shot.end - shot.start);
        const style = textStyleById(shot.textStyle);
        const lineDuration = shot.lines.length > 0 ? duration / shot.lines.length : duration;
        const items: ItemInput[] = [];
        if (style.glow) {
            items.push(glow({ at: 0, dur: duration, x: 0.5, y: 0.5, radius: 0.36, color: colorToken('glow'), intensity: 0.4 }));
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
                    color: colorToken(styleOfLine.color),
                    align: styleOfLine.align ?? 'center',
                    rise: styleOfLine.rise ?? 0,
                    stagger: styleOfLine.stagger ?? 1,
                    glow: styleOfLine.glow ? colorToken('glow') : undefined,
                }),
            );
        });
        if (grainStrength > 0) {
            items.push(grain({ at: 0, dur: duration, strength: grainStrength, density: 14000 }));
        }
        film.scene({
            // The song section id is the stable handle a review note or a
            // partial re-render points at.
            id: shot.section.id,
            duration,
            background: paletteBackground(palette),
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
    const drums = options.drums;
    film.audio({
        bgm: options.bgm === null ? null : { volume: options.bgm ?? 0.1 },
        sfx,
        ...(drums
            ? {
                  patterns: [
                      {
                          at: 0,
                          preset: drums,
                          bpm: plan.song.bpm,
                          bars: Math.min(32, Math.max(1, Math.ceil(plan.song.durationSeconds / grid.barSeconds))),
                          volume: 0.75,
                      },
                  ],
              }
            : {}),
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

/** Distributes `total` lines across shots by weight (largest remainder, stable order). */
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

/** For callers to verify: the beat grid the script actually uses. */
export function planGrid(plan: SongMvPlan): BeatGrid {
    return beatGrid(plan.song.bpm, plan.fps);
}
