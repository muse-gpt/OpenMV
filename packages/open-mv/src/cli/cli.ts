import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCli } from '@wae/commander';

import { registerPresetsCommand } from './commands/presets-cmd.js';
import { registerRenderCommand } from './commands/render-cmd.js';

export function localesRoot(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '../../locales');
}

/** `open-mv` 命令树（@wae/commander，一命令一文件）。 */
export function buildMvCli() {
    const cli = createCli('open-mv')
        .locales(localesRoot(), { envKeys: ['OPEN_MV_LOCALE', 'LOCALE', 'LANG', 'LC_ALL'] })
        .intro('cli.intro');

    registerPresetsCommand(cli);
    registerRenderCommand(cli);

    return cli;
}
