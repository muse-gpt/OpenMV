import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SectionKind, SongProfile, SongSection } from '../index.js';

const SECTION_KINDS = new Set<SectionKind>(['intro', 'verse', 'chorus', 'outro']);

/**
 * Replaces the detected sections with a hand-corrected list.
 *
 * Every entry needs a valid `kind` and ascending, non-overlapping `start`/`end`
 * inside the song. `id` defaults to `s1…`, `energy` to `0.5` and `bars` is
 * derived from the tempo, so a correction file only has to state what the
 * analysis got wrong.
 */
export function withSections(profile: SongProfile, path: string): SongProfile {
    const raw: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error(`--sections ${path} must be a non-empty JSON array`);
    }
    const barSeconds = (60 / profile.bpm) * profile.beatsPerBar;
    let previousEnd = 0;
    const sections: SongSection[] = raw.map((entry, index) => {
        const record = entry as Record<string, unknown>;
        const kind = record.kind;
        if (typeof kind !== 'string' || !SECTION_KINDS.has(kind as SectionKind)) {
            throw new Error(`--sections[${index}].kind must be one of ${[...SECTION_KINDS].join(', ')}`);
        }
        const start = finite(record.start, `--sections[${index}].start`);
        const end = finite(record.end, `--sections[${index}].end`);
        if (start < previousEnd) {
            throw new Error(`--sections[${index}].start ${start} overlaps the previous section`);
        }
        if (end <= start) {
            throw new Error(`--sections[${index}] must end after it starts`);
        }
        if (end > profile.durationSeconds + 1e-6) {
            throw new Error(`--sections[${index}].end ${end} exceeds the song (${profile.durationSeconds.toFixed(3)}s)`);
        }
        previousEnd = end;
        const energy = record.energy === undefined ? 0.5 : finite(record.energy, `--sections[${index}].energy`);
        if (energy < 0 || energy > 1) {
            throw new Error(`--sections[${index}].energy must be within 0..1`);
        }
        return {
            id: typeof record.id === 'string' ? record.id : `s${index + 1}`,
            kind: kind as SectionKind,
            start,
            end,
            energy,
            bars: Math.max(1, Math.round((end - start) / barSeconds)),
        };
    });
    return { ...profile, sections };
}

function finite(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number`);
    }
    return value;
}
