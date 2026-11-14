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
    return withSectionsFrom(profile, JSON.parse(readFileSync(resolve(path), 'utf8')), '--sections');
}

/**
 * Reads a stored `analyze --out` profile.
 *
 * The file is the reviewable form of the analysis: tempo, bar length, duration
 * and the section list all come from disk, so a later `plan --profile` renders
 * the same structure without re-analysing the WAV. Corrupt or contradictory
 * values are rejected instead of being patched.
 */
export function readProfile(path: string): SongProfile {
    const raw: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`profile ${path} must be a JSON object`);
    }
    const record = raw as Record<string, unknown>;
    const bpm = finite(record.bpm, `profile ${path}.bpm`);
    if (bpm <= 0) {
        throw new Error(`profile ${path}.bpm must be positive, got ${bpm}`);
    }
    const beatsPerBar = finite(record.beatsPerBar, `profile ${path}.beatsPerBar`);
    if (!Number.isInteger(beatsPerBar) || beatsPerBar < 1 || beatsPerBar > 16) {
        throw new Error(`profile ${path}.beatsPerBar must be an integer within 1..16, got ${beatsPerBar}`);
    }
    const durationSeconds = finite(record.durationSeconds, `profile ${path}.durationSeconds`);
    if (durationSeconds <= 0) {
        throw new Error(`profile ${path}.durationSeconds must be positive, got ${durationSeconds}`);
    }
    const sampleRate = record.sampleRate === undefined ? 44_100 : finite(record.sampleRate, `profile ${path}.sampleRate`);
    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
        throw new Error(`profile ${path}.sampleRate must be a positive integer, got ${sampleRate}`);
    }
    const beatOffsetSeconds =
        record.beatOffsetSeconds === undefined ? 0 : finite(record.beatOffsetSeconds, `profile ${path}.beatOffsetSeconds`);
    const base: SongProfile = { bpm, beatsPerBar, durationSeconds, sampleRate, beatOffsetSeconds, sections: [] };
    return withSectionsFrom(base, record.sections, `profile ${path}`);
}

/** Shared section validation; `label` names the source in every error. */
function withSectionsFrom(profile: SongProfile, raw: unknown, label: string): SongProfile {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error(`${label} must be a non-empty JSON array`);
    }
    const barSeconds = (60 / profile.bpm) * profile.beatsPerBar;
    let previousEnd = 0;
    const sections: SongSection[] = raw.map((entry, index) => {
        const record = entry as Record<string, unknown>;
        const kind = record.kind;
        if (typeof kind !== 'string' || !SECTION_KINDS.has(kind as SectionKind)) {
            throw new Error(`${label}[${index}].kind must be one of ${[...SECTION_KINDS].join(', ')}`);
        }
        const start = finite(record.start, `${label}[${index}].start`);
        const end = finite(record.end, `${label}[${index}].end`);
        if (start < previousEnd) {
            throw new Error(`${label}[${index}].start ${start} overlaps the previous section`);
        }
        if (end <= start) {
            throw new Error(`${label}[${index}] must end after it starts`);
        }
        if (end > profile.durationSeconds + 1e-6) {
            throw new Error(`${label}[${index}].end ${end} exceeds the song (${profile.durationSeconds.toFixed(3)}s)`);
        }
        previousEnd = end;
        const energy = record.energy === undefined ? 0.5 : finite(record.energy, `${label}[${index}].energy`);
        if (energy < 0 || energy > 1) {
            throw new Error(`${label}[${index}].energy must be within 0..1`);
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
