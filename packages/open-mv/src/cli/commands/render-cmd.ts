import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Cli } from '@wae/commander';

/**
 * Renders an MV module that default-exports a `Film`.
 *
 * The film file only describes authoring intent and exports the film; picture
 * compositing, mixing and encoding all run in the OpenCut engine. Paths resolve
 * against the current working directory and the module must be `.ts`/`.js`.
 */
export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .option('-o, --output <file>', 'cli.opt.output')
        .option('--json', 'cli.opt.json')
        .actionCtx(async (options, _args, ctx) => {
            const filmPath = options._[0];
            const out = typeof options.output === 'string' ? options.output : undefined;
            if (!filmPath || !out) {
                ctx.stderr('usage: open-mv render <film.ts> --output <out.mp4>');
                return 2;
            }
            const module = (await import(pathToFileURL(resolve(filmPath)).href)) as { default?: unknown };
            const film = module.default as { render?: (out: string) => Record<string, unknown> } | undefined;
            if (!film || typeof film.render !== 'function') {
                ctx.stderr(`open-mv: ${filmPath} must default-export an OpenCut Film`);
                return 1;
            }
            const stats = film.render(out) as {
                out: string;
                bytes: number;
                frames: number;
                seconds: number;
                backend: string;
                audio: boolean;
            };
            if (options.json === true) {
                ctx.stdout(JSON.stringify(stats, null, 2));
                return 0;
            }
            ctx.stdout(
                `${stats.out} ${stats.bytes} bytes · ${stats.frames} frames (${stats.seconds.toFixed(1)}s) · ${stats.backend}` +
                    (stats.audio ? ' · audio' : ''),
            );
            return 0;
        });
}
