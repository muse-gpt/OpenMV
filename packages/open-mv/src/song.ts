/**
 * 歌曲解析：把一首歌读成 MV 流程的第一手事实（BPM、拍偏移、段落、能量）。
 *
 * MV 的流程与短片相反：短片是「剧本 → 脚本 → 音乐」，MV 是「歌曲 → 音乐
 * 结构 → 与歌曲匹配的脚本 → 画面」。因此本模块是流程起点，而不是可选工具：
 * 后续 `planSongMv` 只消费这里给出的结构，不再自己猜 BPM。
 *
 * 当前只读 PCM WAV（16/24 bit 整数或 32 bit 浮点）。这是显式输入合同：
 * 其他容器先转成 WAV，不做隐式解码，也不猜采样率。
 */
import { readFileSync } from 'node:fs';

/** 段落类型：由能量与位置判定，不是人工标注。 */
export type SectionKind = 'intro' | 'verse' | 'chorus' | 'outro';

export interface SongSection {
    id: string;
    kind: SectionKind;
    start: number;
    end: number;
    /** 段落平均能量，归一化到 0..1。 */
    energy: number;
    bars: number;
}

export interface SongProfile {
    bpm: number;
    beatsPerBar: number;
    durationSeconds: number;
    sampleRate: number;
    /** 第一拍相对音频起点的偏移（秒），来自起音强度相位。 */
    beatOffsetSeconds: number;
    sections: SongSection[];
}

interface WavPcm {
    sampleRate: number;
    channels: number;
    samples: Float32Array;
}

/** 读取 PCM WAV 并下混为单声道（分析只需要一条包络）。 */
export function readWavPcm(filePath: string): WavPcm {
    const buffer = readFileSync(filePath);
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error(`wav: ${filePath} is not a RIFF/WAVE file`);
    }
    let format = 0;
    let channels = 0;
    let sampleRate = 0;
    let bits = 0;
    let data: Buffer | null = null;
    let offset = 12;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            format = buffer.readUInt16LE(body);
            channels = buffer.readUInt16LE(body + 2);
            sampleRate = buffer.readUInt32LE(body + 4);
            bits = buffer.readUInt16LE(body + 14);
        } else if (id === 'data') {
            data = buffer.subarray(body, Math.min(body + size, buffer.length));
        }
        offset = body + size + (size % 2);
    }
    if (!data || channels <= 0 || sampleRate <= 0) {
        throw new Error(`wav: ${filePath} is missing fmt/data chunks`);
    }
    const bytesPerSample = bits / 8;
    const frames = Math.floor(data.length / (bytesPerSample * channels));
    const mono = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) {
            const at = (frame * channels + channel) * bytesPerSample;
            if (format === 3 && bits === 32) {
                sum += data.readFloatLE(at);
            } else if (format === 1 && bits === 16) {
                sum += data.readInt16LE(at) / 32768;
            } else if (format === 1 && bits === 24) {
                const value = data[at]! | (data[at + 1]! << 8) | (data[at + 2]! << 16);
                sum += ((value << 8) >> 8) / 8388608;
            } else {
                throw new Error(`wav: unsupported format ${format} with ${bits} bits (pcm16/pcm24/float32 only)`);
            }
        }
        mono[frame] = sum / channels;
    }
    return { sampleRate, channels, samples: mono };
}

const HOP = 512;
const WINDOW = 1024;
const MIN_BPM = 60;
const MAX_BPM = 180;

/** 分析一首 WAV 歌曲。 */
export function analyzeWav(filePath: string): SongProfile {
    const wav = readWavPcm(filePath);
    return analyzePcm(wav.samples, wav.sampleRate);
}

/**
 * 分析一段已解码的 PCM。
 *
 * 流程：短时能量 → 起音强度（能量上升沿）→ 自相关测速 → 拍相位 →
 * 按小节能量分段。全部确定性，不用随机、不依赖外部训练模型。
 */
export function analyzePcm(samples: Float32Array, sampleRate: number): SongProfile {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error(`song: sample rate must be positive, got ${sampleRate}`);
    }
    const durationSeconds = samples.length / sampleRate;
    if (durationSeconds < 1) {
        throw new Error(`song: need at least 1 second of audio, got ${durationSeconds.toFixed(2)}s`);
    }

    const frames = Math.max(1, Math.floor((samples.length - WINDOW) / HOP) + 1);
    const energy = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
        const start = frame * HOP;
        let sum = 0;
        for (let i = 0; i < WINDOW; i++) {
            const sample = samples[start + i] ?? 0;
            sum += sample * sample;
        }
        energy[frame] = Math.sqrt(sum / WINDOW);
    }

    const onset = new Float32Array(frames);
    for (let frame = 1; frame < frames; frame++) {
        onset[frame] = Math.max(0, energy[frame]! - energy[frame - 1]!);
    }

    const { lag, bpm } = detectTempo(onset, sampleRate);
    const beatOffsetFrames = beatPhase(onset, lag);
    const barFrames = lag * 4;
    const sections = segment(energy, frames, barFrames, HOP / sampleRate, durationSeconds, beatOffsetFrames);

    return {
        bpm,
        beatsPerBar: 4,
        durationSeconds,
        sampleRate,
        beatOffsetSeconds: (beatOffsetFrames * HOP) / sampleRate,
        sections,
    };
}

function detectTempo(onset: Float32Array, sampleRate: number): { lag: number; bpm: number } {
    const minLag = Math.max(1, Math.round((60 / MAX_BPM) * sampleRate / HOP));
    const maxLag = Math.max(minLag + 1, Math.round((60 / MIN_BPM) * sampleRate / HOP));
    let bestLag = minLag;
    let bestScore = -1;
    for (let candidate = minLag; candidate <= maxLag; candidate++) {
        const score = autocorrelation(onset, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestLag = candidate;
        }
    }
    // 自相关容易落到半速：BPM 低于 80 时检查双倍速，明显更好才采用。
    let bpm = refinedBpm(onset, bestLag, sampleRate);
    if (bpm < 80 && bestLag > 2) {
        const doubleLag = Math.max(2, Math.round(bestLag / 2));
        const doubleScore = autocorrelation(onset, doubleLag);
        if (doubleScore > bestScore * 0.9) {
            bestLag = doubleLag;
            bpm = refinedBpm(onset, bestLag, sampleRate);
        }
    }
    return { lag: bestLag, bpm: Math.round(bpm * 10) / 10 };
}

/** 在整数滞后附近做抛物线插值，避免 0.1 BPM 级误差。 */
function refinedBpm(onset: Float32Array, lag: number, sampleRate: number): number {
    const left = lag > 1 ? autocorrelation(onset, lag - 1) : 0;
    const centre = autocorrelation(onset, lag);
    const right = autocorrelation(onset, lag + 1);
    const denominator = left - 2 * centre + right;
    const delta = denominator === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denominator));
    return 60 / (((lag + delta) * HOP) / sampleRate);
}

function autocorrelation(onset: Float32Array, lag: number): number {
    let sum = 0;
    for (let i = 0; i + lag < onset.length; i++) {
        sum += onset[i]! * onset[i + lag]!;
    }
    return sum / Math.max(1, onset.length - lag);
}

function beatPhase(onset: Float32Array, lag: number): number {
    let bestPhase = 0;
    let bestScore = -1;
    for (let phase = 0; phase < lag; phase++) {
        let score = 0;
        for (let i = phase; i < onset.length; i += lag) {
            score += onset[i]!;
        }
        if (score > bestScore) {
            bestScore = score;
            bestPhase = phase;
        }
    }
    return bestPhase;
}

function segment(
    energy: Float32Array,
    frames: number,
    barFrames: number,
    frameSeconds: number,
    durationSeconds: number,
    offsetFrames: number,
): SongSection[] {
    const barCount = Math.max(1, Math.floor((frames - offsetFrames) / barFrames));
    const barEnergy: number[] = [];
    for (let bar = 0; bar < barCount; bar++) {
        const start = offsetFrames + bar * barFrames;
        const end = Math.min(frames, start + barFrames);
        const window: number[] = [];
        for (let frame = start; frame < end; frame++) {
            window.push(energy[frame]!);
        }
        // 取每小节最响 10% 帧的均值：既不被稀疏鼓点摊薄，也不被跨边界的
        // 混合小节拉平（均值会被 50/50 的边界小节稀释）。
        window.sort((a, b) => b - a);
        const top = Math.max(1, Math.floor(window.length * 0.1));
        let sum = 0;
        for (let index = 0; index < top; index++) {
            sum += window[index]!;
        }
        barEnergy.push(sum / top);
    }
    const peak = Math.max(...barEnergy, 1e-9);
    const normalized = barEnergy.map((value) => value / peak);
    const bucket = (value: number): 'high' | 'low' | 'mid' => (value > 0.72 ? 'high' : value < 0.45 ? 'low' : 'mid');

    interface Run {
        from: number;
        to: number;
    }
    let runs: Run[] = [];
    normalized.forEach((value, index) => {
        const last = runs[runs.length - 1];
        if (last && bucket(value) === bucket(average(normalized, last))) {
            last.to = index;
        } else {
            runs.push({ from: index, to: index });
        }
    });

    // 不足两小节的碎段并回能量更接近的邻居，避免每小节切一次。
    let merged = true;
    while (merged && runs.length > 1) {
        merged = false;
        for (let index = 0; index < runs.length; index++) {
            const run = runs[index]!;
            // 首尾允许短段落（很短的 intro/outro 是真实的），只并内部碎段。
            if (run.to - run.from + 1 >= 2 || index === 0 || index === runs.length - 1) {
                continue;
            }
            const own = average(normalized, run);
            const previous = index > 0 ? { index: index - 1, distance: Math.abs(average(normalized, runs[index - 1]!) - own) } : null;
            const next = index < runs.length - 1 ? { index: index + 1, distance: Math.abs(average(normalized, runs[index + 1]!) - own) } : null;
            const target = !previous ? next : !next ? previous : previous.distance <= next.distance ? previous : next;
            if (!target) {
                break;
            }
            const neighbour = runs[target.index]!;
            neighbour.from = Math.min(neighbour.from, run.from);
            neighbour.to = Math.max(neighbour.to, run.to);
            runs.splice(index, 1);
            merged = true;
            break;
        }
    }

    const barSeconds = barFrames * frameSeconds;
    const sections = runs.map((run, index) => {
        const start = Math.max(0, (offsetFrames + run.from * barFrames) * frameSeconds);
        const end = Math.min(durationSeconds, (offsetFrames + (run.to + 1) * barFrames) * frameSeconds);
        const energyValue = average(normalized, run);
        const energyBucket = bucket(energyValue);
        const kind: SectionKind =
            energyBucket === 'high'
                ? 'chorus'
                : index === 0 && energyBucket === 'low'
                  ? 'intro'
                  : index === runs.length - 1 && energyBucket === 'low'
                    ? 'outro'
                    : 'verse';
        return {
            id: `s${index + 1}`,
            kind,
            start,
            end,
            energy: Math.round(energyValue * 100) / 100,
            bars: run.to - run.from + 1,
        };
    });

    // 相对判定：全曲明显更响的那一段就是副歌，即使没跨过绝对阈值。
    const energies = sections.map((section) => section.energy).sort((a, b) => a - b);
    const median = energies[Math.floor(energies.length / 2)] ?? 0;
    let loudest = 0;
    sections.forEach((section, index) => {
        if (section.energy > (sections[loudest]?.energy ?? 0)) {
            loudest = index;
        }
    });
    const peakSection = sections[loudest];
    if (peakSection && peakSection.kind !== 'chorus' && peakSection.energy > 0.5 && peakSection.energy > median * 1.35) {
        peakSection.kind = 'chorus';
    }
    return sections;
}

function average(values: number[], run: { from: number; to: number }): number {
    let sum = 0;
    for (let index = run.from; index <= run.to; index++) {
        sum += values[index] ?? 0;
    }
    return sum / Math.max(1, run.to - run.from + 1);
}
