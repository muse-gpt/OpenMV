/**
 * Native binding loader for `@wae/open-mv`.
 *
 * Song analysis is implemented only in the neutral native core. A missing
 * binary produces an actionable error instead of silently degrading to a JS
 * implementation.
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export interface NativeSongSection {
    id: string;
    kind: string;
    start: number;
    end: number;
    energy: number;
    bars: number;
}

export interface NativeSongProfile {
    bpm: number;
    beatsPerBar: number;
    durationSeconds: number;
    sampleRate: number;
    beatOffsetSeconds: number;
    sections: NativeSongSection[];
}

export interface NativeBinding {
    version(): string;
    analyzeWav(options: { path: string }): NativeSongProfile;
}

const PLATFORM_PACKAGE = '@wae/open-mv-win32-x64';

function candidates(): string[] {
    const override = process.env.OPEN_MV_NATIVE;
    const here = path.dirname(fileURLToPath(import.meta.url));
    const local = path.resolve(here, '..', '..', 'open-mv-win32-x64');
    const packages = [PLATFORM_PACKAGE, local];
    return override ? [override, ...packages] : packages;
}

function load(): NativeBinding {
    const errors: string[] = [];
    for (const candidate of candidates()) {
        try {
            return require(candidate) as NativeBinding;
        }
        catch (error) {
            errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(
        `OpenMV native binding is not available for ${os.platform()}-${os.arch()}.\n` +
            `Set OPEN_MV_NATIVE to a built .node file, or install ${PLATFORM_PACKAGE}.\n` +
            `Tried:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
    );
}

export const native = lazyLoad();

/** Loads the native binding on first use, so TS-only workflows never require it. */
function lazyLoad(): NativeBinding {
    let cached: NativeBinding | undefined;
    return new Proxy({} as NativeBinding, {
        get(_target, property) {
            cached ??= load();
            const value = Reflect.get(cached, property);
            return typeof value === 'function' ? value.bind(cached) : value;
        },
    });
}
