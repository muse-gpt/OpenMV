import { resolve } from 'node:path';

import type { Cli } from '@wae/commander';

import { analyzeWav } from '../../song.js';

/**
 * 分析歌曲 WAV：输出 BPM、拍偏移与段落结构。
 *
 * 这是 MV 流程的第一步（歌曲 → 音乐结构 → 脚本 → 画面）。只接受 PCM WAV；
 * 其他容器先转换，不做隐式解码。
 */
export function registerAnalyzeCommand(cli: Cli): void {
    cli.command('analyze', 'cli.cmd.analyze')
        .option('--json', 'cli.opt.json')
        .actionCtx((options, _args, ctx) => {
            const file = options._[0];
            if (!file) {
                ctx.stderr('usage: open-mv analyze <song.wav>');
                return 2;
            }
            try {
                const profile = analyzeWav(resolve(file));
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
