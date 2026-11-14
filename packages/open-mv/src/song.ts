/**
 * Song facts: read a song into the first-hand data an MV flow starts from
 * (BPM, beat offset, sections, energy).
 *
 * MV runs the opposite way to a short film: a short film goes "script → code →
 * music", an MV goes "song → musical structure → script matched to the song →
 * picture". This module is therefore the entry point, not an optional tool:
 * `planSongMv` only consumes the structure reported here and never guesses the
 * BPM itself.
 *
 * The analysis implementation lives only in the native core
 * (`media.audio::analysis`): WAV decoding, energy envelope, autocorrelation
 * tempo detection, beat phase and bar segmentation all run in Rust. This module
 * keeps types and a thin call — it holds no second TypeScript algorithm.
 */
import { native } from './native.js';

/** Section kind, derived from energy and position rather than annotated. */
export type SectionKind = 'intro' | 'verse' | 'chorus' | 'outro';

export interface SongSection {
    id: string;
    kind: SectionKind;
    start: number;
    end: number;
    /** Section energy, normalized to 0..1. */
    energy: number;
    bars: number;
}

export interface SongProfile {
    bpm: number;
    beatsPerBar: number;
    durationSeconds: number;
    sampleRate: number;
    /** Offset of the first beat from the audio start, in seconds. */
    beatOffsetSeconds: number;
    sections: SongSection[];
}

/**
 * Analyzes a PCM WAV song.
 *
 * Only PCM16 / PCM24 / 32-bit float WAV is accepted; convert other containers
 * explicitly first. Missing files, broken containers, unsupported sample
 * formats and audio shorter than one second are rejected by the native core
 * with an `invalid_input:` prefix.
 */
export function analyzeWav(filePath: string): SongProfile {
    return native.analyzeWav({ path: filePath }) as SongProfile;
}
