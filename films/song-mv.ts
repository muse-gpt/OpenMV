/**
 * 歌曲优先的 MV 示例 ——「档案」(24 秒)
 *
 * 流程与短片相反：先有歌曲结构与歌词，再写分镜脚本，最后出片。
 *
 *   1. 歌曲事实（等价于 `open-mv analyze song.wav` 的输出）
 *   2. planSongMv：段落 → 镜头（运镜/字效按段落能量自动选）
 *   3. compileSongMv：脚本 → Film → MP4
 *
 * 这里的 `profile` 是分析结果的手写等价物，替换成真实分析即可：
 *
 *   const profile = analyzeWav('song.wav');
 *
 * 渲染：open-mv render films/song-mv.ts -o song-mv.mp4
 */
import { compileSongMv, planSongMv } from '@wae/open-mv';
import type { SongProfile } from '@wae/open-mv';

const profile: SongProfile = {
    bpm: 96,
    beatsPerBar: 4,
    durationSeconds: 24,
    sampleRate: 44_100,
    beatOffsetSeconds: 0.02,
    sections: [
        { id: 's1', kind: 'intro', start: 0, end: 5.0, energy: 0.35, bars: 8 },
        { id: 's2', kind: 'verse', start: 5.0, end: 12.5, energy: 0.55, bars: 12 },
        { id: 's3', kind: 'chorus', start: 12.5, end: 22.5, energy: 0.9, bars: 16 },
        { id: 's4', kind: 'outro', start: 22.5, end: 24.0, energy: 0.3, bars: 2 },
    ],
};

// 分镜脚本是纯数据，可以先打印出来复核再编译。
const plan = planSongMv({
    song: profile,
    palette: 'dusk-film',
    lines: [
        '把名字写进旧档案',
        '第一页是那年夏天',
        '风把日期吹散',
        '我在副歌里重写一遍',
        '让所有停顿都算数',
        '最后一页留给以后',
    ],
    fps: 30,
    width: 1280,
    height: 720,
});

export default compileSongMv(plan, {
    grain: 0.05,
    hits: true,
    bgm: 0.1,
    voice: {
        syllables: [
            { onset: 'r', vowel: 'a', pitch: 293.66, beats: 4 },
            { vowel: 'o', pitch: 349.23, beats: 4 },
            { onset: 'n', vowel: 'e', pitch: 392.0, beats: 4 },
            { vowel: 'i', pitch: 440.0, beats: 6 },
            { onset: 's', vowel: 'u', pitch: 392.0, beats: 4 },
            { vowel: 'a', pitch: 329.63, beats: 4 },
        ],
    },
});
