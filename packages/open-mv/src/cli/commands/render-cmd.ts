import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Cli } from '@wae/commander';

/**
 * 渲染一个导出 `Film` 的 MV 模块。
 *
 * 影片文件只描述作者意图并默认导出 Film；画面合成、混音与编码全部由
 * OpenCut 引擎完成。路径按当前工作目录解析，模块必须是 `.ts`/`.js`。
 */
export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .option('-o, --output <file>', 'cli.opt.output')
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
            ctx.stdout(
                `${stats.out} ${stats.bytes} bytes · ${stats.frames} frames (${stats.seconds.toFixed(1)}s) · ${stats.backend}` +
                    (stats.audio ? ' · audio' : ''),
            );
            return 0;
        });
}
