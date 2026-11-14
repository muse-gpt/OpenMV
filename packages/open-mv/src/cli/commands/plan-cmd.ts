import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Cli } from '@wae/commander';

import { planSongMv } from '../../plan.js';
import { analyzeWav } from '../../song.js';
import type { SongProfile } from '../../index.js';
import { readProfile, withSections } from '../sections.js';

/**
 * Plans the storyboard script from a song without rendering.
 *
 * This is the reviewable middle of the MV flow: the song is analysed, the
 * script (sections → shots → lines, camera and text style) is printed, and the
 * same object can be rendered later. Reviewing a shot list does not require a
 * render, and a later render consumes the same plan.
 *
 * `--lines` reads one lyric line per non-empty, non-`#` line.
 *
 * `--profile` reads a stored `analyze --out` profile instead of the WAV, so a
 * reviewed tempo and section list survives without the audio being re-analysed.
 * It already carries sections, so it cannot be combined with `--sections`.
 */
export function registerPlanCommand(cli: Cli): void {
    cli.command('plan', 'cli.cmd.plan')
        .option('--profile <file>', 'cli.opt.profile')
        .option('--lines <file>', 'cli.opt.lines')
        .option('--sections <file>', 'cli.opt.sections')
        .option('--palette <id>', 'cli.opt.palette')
        .option('--camera <id>', 'cli.opt.camera')
        .option('--style <id>', 'cli.opt.style')
        .option('--fps <n>', 'cli.opt.fps')
        .option('--size <WxH>', 'cli.opt.size')
        .option('--out <file>', 'cli.opt.planOut')
        .option('--json', 'cli.opt.json')
        .actionCtx((options, _args, ctx) => {
            const file = options._[0];
            const profilePath = typeof options.profile === 'string' ? options.profile : undefined;
            if (!file && profilePath === undefined) {
                ctx.stderr('usage: open-mv plan <song.wav> [--lines lines.txt] [--size 1280x720] [--json]');
                ctx.stderr('       open-mv plan --profile profile.json [--lines lines.txt] [--out plan.json]');
                return 2;
            }
            try {
                if (profilePath !== undefined && typeof options.sections === 'string') {
                    throw new Error('--profile already carries sections, so it cannot be combined with --sections');
                }
                const size = parseSize(options.size);
                let analyzed: SongProfile;
                if (profilePath !== undefined) {
                    analyzed = readProfile(profilePath);
                }
                else if (file !== undefined) {
                    analyzed = analyzeWav(resolve(file));
                }
                else {
                    throw new Error('a song WAV or --profile is required');
                }
                const source = profilePath ?? file ?? '';
                const song = typeof options.sections === 'string' ? withSections(analyzed, options.sections) : analyzed;
                const plan = planSongMv({
                    song,
                    lines: typeof options.lines === 'string' ? readLines(options.lines) : [],
                    palette: text(options.palette),
                    camera: text(options.camera),
                    textStyle: text(options.style),
                    fps: number(options.fps),
                    width: size?.width,
                    height: size?.height,
                });
                if (options.json === true) {
                    ctx.stdout(JSON.stringify(plan, null, 2));
                    return 0;
                }
                if (typeof options.out === 'string') {
                    writeFileSync(resolve(options.out), `${JSON.stringify(plan, null, 2)}\n`);
                    ctx.stdout(`plan written to ${options.out}`);
                }
                ctx.stdout(
                    `${source}: ${plan.song.bpm.toFixed(1)} BPM · ${plan.song.beatsPerBar}/4 · ` +
                        `${plan.song.durationSeconds.toFixed(1)}s · ${plan.width}x${plan.height} @ ${plan.fps} fps`,
                );
                ctx.stdout(ctx.t('cli.plan.shots'));
                for (const shot of plan.shots) {
                    ctx.stdout(
                        `  ${shot.index}  ${shot.section.kind.padEnd(7)} ${shot.start.toFixed(2)}–${shot.end.toFixed(2)}s` +
                            `  camera ${shot.camera}  style ${shot.textStyle}  ${shot.lines.length} lines`,
                    );
                }
                return 0;
            } catch (error) {
                ctx.stderr(`open-mv: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
        });
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

/** Parses `1280x720`; anything else is a usage error, never a silent default. */
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
