import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Cli } from '@wae/commander';
import { verifyRender } from '@wae/open-cut';

/**
 * Renders an MV module into a temporary file and checks the delivery facts.
 *
 * The checks come from `@wae/open-cut` so every product applies the same gate:
 * output written, frame count matching the range, duration consistency, an
 * audible unclipped bed and unique scene spans. The file is deleted afterwards.
 */
export function registerVerifyCommand(cli: Cli): void {
    cli.command('verify', 'cli.cmd.verify')
        .option('-o, --output <file>', 'cli.opt.output')
        .option('--json', 'cli.opt.json')
        .actionCtx(async (options, _args, ctx) => {
            const filmPath = options._[0];
            if (!filmPath) {
                ctx.stderr('usage: open-mv verify <film.ts>');
                return 2;
            }
            const out = typeof options.output === 'string' ? resolve(options.output) : join(tmpdir(), `open-mv-verify-${process.pid}.mp4`);
            try {
                const module = (await import(pathToFileURL(resolve(filmPath)).href)) as { default?: unknown };
                const film = module.default as { render?: (out: string) => unknown } | undefined;
                if (!film || typeof film.render !== 'function') {
                    ctx.stderr(`open-mv: ${filmPath} must default-export an OpenCut Film`);
                    return 1;
                }
                const stats = film.render(out) as Parameters<typeof verifyRender>[0];
                const checks = verifyRender(stats);
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
                if (typeof options.output !== 'string') {
                    rmSync(out, { force: true });
                }
            }
        });
}
