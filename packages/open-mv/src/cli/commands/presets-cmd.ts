import type { Cli } from '@wae/commander';

import { CAMERA_MOVES, PALETTES, TEXT_STYLES } from '../../index.js';

/** Lists the MV preset catalogue (palettes, camera moves, lyric styles) so
 *  authors and agents can look up ids. */
export function registerPresetsCommand(cli: Cli): void {
    cli.command('presets', 'cli.cmd.presets')
        .option('--json', 'cli.opt.json')
        .actionCtx((options, _args, ctx) => {
            if (options.json === true) {
                ctx.stdout(JSON.stringify({ palettes: PALETTES, camera: CAMERA_MOVES, textStyles: TEXT_STYLES }, null, 2));
                return 0;
            }
            ctx.stdout(ctx.t('cli.presets.palettes'));
            for (const palette of PALETTES) {
                ctx.stdout(`  ${palette.id.padEnd(14)} ${palette.label}  ink=${palette.ink} accent=${palette.accent}`);
            }
            ctx.stdout('');
            ctx.stdout(ctx.t('cli.presets.camera'));
            for (const camera of CAMERA_MOVES) {
                ctx.stdout(`  ${camera.id.padEnd(14)} ${camera.label}  zoom ${camera.zoomFrom}→${camera.zoomTo} · ${camera.ease}`);
            }
            ctx.stdout('');
            ctx.stdout(ctx.t('cli.presets.textStyles'));
            for (const style of TEXT_STYLES) {
                ctx.stdout(`  ${style.id.padEnd(14)} ${style.label}  ${style.size}px · ${style.color}${style.glow ? ' · glow' : ''}`);
            }
            return 0;
        });
}
