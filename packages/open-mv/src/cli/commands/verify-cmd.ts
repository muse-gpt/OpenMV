import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { Cli } from '@wae/commander';
import { verifyRender } from '@wae/open-cut';

import { renderFilmModule, renderFromPlan, renderFromSong } from './render-cmd.js';

/**
 * Renders an MV into a temporary file and checks the delivery facts.
 *
 * Every render entry point is verifiable: a film module, a reviewed storyboard
 * plan, or a song analysed and planned in one step. The checks come from
 * `@wae/open-cut` so every product applies the same gate: output written, frame
 * count matching the range, duration consistency, an audible unclipped bed and
 * unique scene spans. The temporary file is deleted afterwards.
 */
export function registerVerifyCommand(cli: Cli): void {
    cli.command('verify', 'cli.cmd.verify')
        .option('-o, --output <file>', 'cli.opt.output')
        .option('--song <wav>', 'cli.opt.song')
        .option('--plan <file>', 'cli.opt.plan')
        .option('--lines <file>', 'cli.opt.lines')
        .option('--sections <file>', 'cli.opt.sections')
        .option('--palette <id>', 'cli.opt.palette')
        .option('--camera <id>', 'cli.opt.camera')
        .option('--style <id>', 'cli.opt.style')
        .option('--size <WxH>', 'cli.opt.size')
        .option('--fps <n>', 'cli.opt.fps')
        .option('--drums <preset>', 'cli.opt.drums')
        .option('--json', 'cli.opt.json')
        .actionCtx(async (options, _args, ctx) => {
            const keep = typeof options.output === 'string';
            const out = keep ? resolve(options.output as string) : join(tmpdir(), `open-mv-verify-${process.pid}.mp4`);
            try {
                const stats =
                    typeof options.song === 'string'
                        ? renderFromSong(options.song, out, options)
                        : typeof options.plan === 'string'
                          ? renderFromPlan(options.plan, out, options)
                          : await renderFilmModule(options._[0], out);
                const checks = verifyRender(stats as Parameters<typeof verifyRender>[0]);
                const ok = checks.every((check) => check.ok);
                if (options.json === true) {
                    ctx.stdout(JSON.stringify({ ok, checks, stats }, null, 2));
                }
                else {
                    for (const check of checks) {
                        ctx.stdout(`${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`);
                    }
                }
                return ok ? 0 : 1;
            }
            catch (error) {
                ctx.stderr(`open-mv: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
            finally {
                // A default temporary file is a gate, not a deliverable.
                if (!keep) {
                    rmSync(out, { force: true });
                }
            }
        });
}
