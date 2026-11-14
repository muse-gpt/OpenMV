/**
 * 歌曲解析：把一首歌读成 MV 流程的第一手事实（BPM、拍偏移、段落、能量）。
 *
 * MV 的流程与短片相反：短片是「剧本 → 脚本 → 音乐」，MV 是「歌曲 → 音乐
 * 结构 → 与歌曲匹配的脚本 → 画面」。因此本模块是流程起点，而不是可选工具：
 * 后续 `planSongMv` 只消费这里给出的结构，不再自己猜 BPM。
 *
 * 分析实现只在原生核（`media.audio::analysis`）：WAV 解码、能量包络、自相关
 * 测速、拍相位与按小节分段全在 Rust 完成。本模块只保留类型与薄调用，不再
 * 持有第二套 TS 算法。
 */
import { native } from './native.js';

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

/**
 * 分析一首 PCM WAV 歌曲。
 *
 * 只接受 PCM16 / PCM24 / 32 bit 浮点 WAV，其他容器先显式转换；缺文件、坏容器、
 * 不支持的采样格式与不足一秒的音频都由原生核以 `invalid_input:` 前缀报错。
 */
export function analyzeWav(filePath: string): SongProfile {
    return native.analyzeWav({ path: filePath }) as SongProfile;
}
