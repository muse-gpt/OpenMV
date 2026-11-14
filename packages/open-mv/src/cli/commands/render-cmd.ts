import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Cli } from '@wae/commander';

import { analyzeWav, compileSongMv, planSongMv } from '../../index.js';
import type { SectionKind, SongProfile, SongSection } from '../../index.js';

/** The render report both modes print. */
interface RenderStats {
    out: string;
    bytes: number;
    frames: number;
    seconds: number;
    backend: string;
    audio: boolean;
    audioLevel?: { peakDbfs: number; rmsDbfs: number; clipped: number } | null;
    scenes?: Array<{ id: string; range: [number, number]; rendered: boolean }>;
}

/**
 * Renders an MV from either a film module or a song.
 *
 * The module mode loads a file that default-exports an OpenCut `Film`. The song
 * mode runs the whole first-class flow in one command: analyse the WAV, plan
 * the storyboard (optionally with corrected sections), compile and render, so a
 * song can become an MV without writing a TypeScript module first.
 *
 * Picture compositing, mixing and encoding always belong to the OpenCut engine.
 */
export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .option('-o, --output <file>', 'cli.opt.output')
        .option('--song <wav>', 'cli.opt.song')
        .option('--lines <file>', 'cli.opt.lines')
        .option('--sections <file>', 'cli.opt.sections')
        .option('--palette <id>', 'cli.opt.palette')
        .option('--size <WxH>', 'cli.opt.size')
        .option('--fps <n>', 'cli.opt.fps')
        .option('--drums <preset>', 'cli.opt.drums')
        .option('--json', 'cli.opt.json')
        .actionCtx(async (options, _args, ctx) => {
            const out = typeof options.output === 'string' ? resolve(options.output) : undefined;
            if (!out) {
                ctx.stderr('usage: open-mv render <film.ts> --output <out.mp4> | open-mv render --song <song.wav> --output <out.mp4>');
                return 2;
            }
            try {
                const stats =
                    typeof options.song === 'string'
                        ? renderFromSong(options.song, out, options)
                        : await renderFilmModule(options._[0], out);
                if (options.json === true) {
                    ctx.stdout(JSON.stringify(stats, null, 2));
                    return 0;
                }
                ctx.stdout(
                    `${stats.out} ${stats.bytes} bytes · ${stats.frames} frames (${stats.seconds.toFixed(1)}s) · ${stats.backend}` +
                        (stats.audio ? ' · audio' : ''),
                );
                if (stats.audioLevel) {
                    ctx.stdout(
                        `audio level: peak ${stats.audioLevel.peakDbfs.toFixed(1)} dBFS, rms ${stats.audioLevel.rmsDbfs.toFixed(1)} dBFS` +
                            (stats.audioLevel.clipped > 0 ? `, clipped ${stats.audioLevel.clipped}` : ''),
                    );
                }
                for (const scene of stats.scenes ?? []) {
                    ctx.stdout(`scene ${scene.id}: frames ${scene.range[0]}..${scene.range[1]}`);
                }
                return 0;
            }
            catch (error) {
                ctx.stderr(`open-mv: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
        });
}

/** Song mode: analysis → plan → compile → render. */
function renderFromSong(songPath: string, out: string, options: Record<string, unknown>): RenderStats {
    const analyzed = analyzeWav(resolve(songPath));
    const song = typeof options.sections === 'string' ? withSections(analyzed, options.sections) : analyzed;
    const size = parseSize(options.size);
    const plan = planSongMv({
        song,
        lines: typeof options.lines === 'string' ? readLines(options.lines) : [],
        palette: text(options.palette),
        fps: number(options.fps),
        width: size?.width,
        height: size?.height,
    });
    const film = compileSongMv(plan, {
        drums: typeof options.drums === 'string' ? options.drums : null,
    });
    return film.render(out) as RenderStats;
}

/** Film mode: a module that default-exports an OpenCut `Film`. */
async function renderFilmModule(filmPath: string | undefined, out: string): Promise<RenderStats> {
    if (!filmPath) {
        throw new Error('render needs a film module or --song <song.wav>');
    }
    const module = (await import(pathToFileURL(resolve(filmPath)).href)) as { default?: unknown };
    const film = module.default as { render?: (out: string) => unknown } | undefined;
    if (!film || typeof film.render !== 'function') {
        throw new Error(`${filmPath} must default-export an OpenCut Film`);
    }
    return film.render(out) as RenderStats;
}

const SECTION_KINDS = new Set<SectionKind>(['intro', 'verse', 'chorus', 'outro']);

/**
 * Replaces the detected sections with a hand-corrected list.
 *
 * Every entry needs a valid `kind` and ascending, non-overlapping `start`/`end`
 * inside the song. `id` defaults to `s1…`, `energy` to `0.5` and `bars` is
 * derived from the tempo, so a correction file only has to state what the
 * analysis got wrong.
 */
function withSections(profile: SongProfile, path: string): SongProfile {
    const raw: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error(`--sections ${path} must be a non-empty JSON array`);
    }
    const barSeconds = (60 / profile.bpm) * profile.beatsPerBar;
    let previousEnd = 0;
    const sections: SongSection[] = raw.map((entry, index) => {
        const record = entry as Record<string, unknown>;
        const kind = record.kind;
        if (typeof kind !== 'string' || !SECTION_KINDS.has(kind as SectionKind)) {
            throw new Error(`--sections[${index}].kind must be one of ${[...SECTION_KINDS].join(', ')}`);
        }
        const start = finite(record.start, `--sections[${index}].start`);
        const end = finite(record.end, `--sections[${index}].end`);
        if (start < previousEnd) {
            throw new Error(`--sections[${index}].start ${start} overlaps the previous section`);
        }
        if (end <= start) {
            throw new Error(`--sections[${index}] must end after it starts`);
        }
        if (end > profile.durationSeconds + 1e-6) {
            throw new Error(`--sections[${index}].end ${end} exceeds the song (${profile.durationSeconds.toFixed(3)}s)`);
        }
        previousEnd = end;
        const energy = record.energy === undefined ? 0.5 : finite(record.energy, `--sections[${index}].energy`);
        if (energy < 0 || energy > 1) {
            throw new Error(`--sections[${index}].energy must be within 0..1`);
        }
        return {
            id: typeof record.id === 'string' ? record.id : `s${index + 1}`,
            kind: kind as SectionKind,
            start,
            end,
            energy,
            bars: Math.max(1, Math.round((end - start) / barSeconds)),
        };
    });
    return { ...profile, sections };
}

function finite(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number`);
    }
    return value;
}

function text(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`--fps must be a number, got ${String(value)}`);
    }
    return parsed;
}

/** Parses `1280x720`; anything else is a usage error. */
function parseSize(value: unknown): { width: number; height: number } | undefined {
    if (value === undefined) {
        return undefined;
    }
    const match = /^(\d+)x(\d+)$/i.exec(String(value));
    if (!match) {
        throw new Error(`--size must look like 1280x720, got ${String(value)}`);
    }
    return { width: Number(match[1]), height: Number(match[2]) };
}

/** Reads lyric lines: one per line, blanks and `#` comments ignored. */
function readLines(path: string): string[] {
    return readFileSync(resolve(path), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}
