/**
 * MV builders: compile lyric lines and beats into an OpenCut Film.
 *
 * Nothing is rendered here and the engine is not copied: picture, mixing and
 * encoding all belong to OpenCut. This layer only lowers MV authoring intent
 * (lyrics, meter, palette, camera, lyric style) into scenes and tracks. Time in
 * the authoring layer is always seconds and beats; {@link beatGrid} owns the
 * frame conversion together with the engine.
 */
import { Film, colorToken, glow, grain, shape, text } from '@wae/open-cut';
import type { Onset, Vowel } from '@wae/open-cut';

import { cameraById, paletteBackground, paletteById, paletteDesign, textStyleById } from './presets.js';
import type { MvCamera, MvPalette, MvTextStyle } from './presets.js';

/** Beat grid: the single owner of BPM-to-frame conversion. */
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

/** Builds a beat grid from BPM and frame rate (4/4, four beats per bar). */
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

/** One lyric line. */
export interface LyricLineInput {
    text: string;
    /** Beats this line occupies (default 4 = one bar). */
    beats?: number;
    /** Lyric-style id for this line (overrides the film default). */
    style?: string;
}

/** One synthesized vocal phrase (the `media.voice` contract: five vowels × seven onset classes). */
export interface LyricVoiceInput {
    syllables: Array<{ onset?: Onset; vowel: Vowel; pitch: number; beats: number }>;
    /** Start time in seconds; defaults to the first lyric line. */
    at?: number;
    volume?: number;
    breath?: number;
    seed?: number;
}

/** MV builder options. */
export interface LyricMvOptions {
    lines: LyricLineInput[];
    /** Tempo, default 100 BPM. */
    tempoBpm?: number;
    fps?: number;
    width?: number;
    height?: number;
    /** Palette id, default `neon-night`. */
    palette?: string;
    /** Camera-move id, default `push-in`. */
    camera?: string;
    /** Opening title (occupies `titleBeats` beats). */
    title?: string;
    titleBeats?: number;
    /** Film-wide default lyric style, default `lyric-clean`. */
    textStyle?: string;
    /** BGM volume; `null` disables it. */
    bgm?: number | null;
    /** Place one hit sound at the start of every lyric line. */
    hits?: boolean;
    /** Synthesized vocal; omitted means picture and BGM only. */
    voice?: LyricVoiceInput | null;
    /** Fill the film with a drum-groove preset at `tempoBpm`. */
    drums?: string | null;
    /** Grain strength, 0 disables it. */
    grain?: number;
}

/**
 * Compiles lyric lines into one MV.
 *
 * Every line becomes a scene whose duration comes from its beat count; style,
 * palette and camera come from the preset catalogue. Unknown preset ids, empty
 * lyrics or an invalid BPM throw explicitly instead of falling back silently.
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
            id: 'title',
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

    for (const [index, line] of options.lines.entries()) {
        const style = line.style ? textStyleById(line.style) : defaultStyle;
        const duration = Math.max(0.35, grid.secondsOf(line.beats ?? 4));
        lineStarts.push(cursor);
        film.scene({
            id: `line-${index}`,
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

/** One horizontal divider line, used as breathing room between lyric sections. */
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
