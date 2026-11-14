import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Cli } from '@wae/commander';

import { analyzeWav } from '../../song.js';

/**
 * Analyzes a song WAV: prints BPM, beat offset and section structure.
 *
 * This is the first step of the MV flow (song → musical structure → script →
 * picture). Only PCM WAV is accepted; convert other containers first instead of
 * decoding implicitly.
 *
 * `--out` stores the same profile `plan --profile` reads back, so a reviewed or
 * hand-corrected structure can be reused without re-analysing the audio.
 */
export function registerAnalyzeCommand(cli: Cli): void {
    cli.command('analyze', 'cli.cmd.analyze')
        .option('--out <file>', 'cli.opt.analyzeOut')
        .option('--json', 'cli.opt.json')
        .actionCtx((options, _args, ctx) => {
            const file = options._[0];
            if (!file) {
                ctx.stderr('usage: open-mv analyze <song.wav> [--out profile.json]');
                return 2;
            }
            try {
                const profile = analyzeWav(resolve(file));
                if (typeof options.out === 'string') {
                    writeFileSync(resolve(options.out), `${JSON.stringify(profile, null, 2)}\n`);
                    ctx.stdout(`profile written to ${options.out}`);
                }
                if (options.json === true) {
                    ctx.stdout(JSON.stringify(profile, null, 2));
                    return 0;
                }
                ctx.stdout(
                    `${file}: ${profile.bpm} BPM · ${profile.beatsPerBar}/4 · ${profile.durationSeconds.toFixed(1)}s · ` +
                        `beat offset ${profile.beatOffsetSeconds.toFixed(3)}s`,
                );
                ctx.stdout(ctx.t('cli.analyze.sections'));
                for (const section of profile.sections) {
                    ctx.stdout(
                        `  ${section.id}  ${section.kind.padEnd(7)} ${section.start.toFixed(2)}–${section.end.toFixed(2)}s` +
                            `  energy ${section.energy.toFixed(2)}  ${section.bars} bars`,
                    );
                }
                return 0;
            } catch (error) {
                ctx.stderr(`open-mv: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
        });
}
