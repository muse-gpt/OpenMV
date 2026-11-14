import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCli } from '@wae/commander';

import { registerAnalyzeCommand } from './commands/analyze-cmd.js';
import { registerPresetsCommand } from './commands/presets-cmd.js';
import { registerRenderCommand } from './commands/render-cmd.js';
import { registerVersionCommand } from './commands/version-cmd.js';

export function localesRoot(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '../../locales');
}

/** `open-mv` command tree (@wae/commander, one command per file). */
export function buildMvCli() {
    const cli = createCli('open-mv')
        .locales(localesRoot(), { envKeys: ['OPEN_MV_LOCALE', 'LOCALE', 'LANG', 'LC_ALL'] })
        .intro('cli.intro');

    registerAnalyzeCommand(cli);
    registerPresetsCommand(cli);
    registerRenderCommand(cli);
    registerVersionCommand(cli);

    return cli;
}
