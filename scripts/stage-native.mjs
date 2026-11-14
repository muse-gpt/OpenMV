/**
 * Copies the built cdylib into the staged platform package.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('target/release/openmv_napi.dll');
const target = resolve('packages/open-mv-win32-x64/open-mv.win32-x64.node');

if (!existsSync(source)) {
    console.error(`missing ${source}, build the crate first`);
    process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`staged ${target}`);
