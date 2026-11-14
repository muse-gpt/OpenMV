/**
 * 歌词 MV 示例 ——「夜行」(12.5 秒)
 *
 * 全部画面与声音由预设和歌词行编译：
 * 4 行歌词 × 4 拍（96 BPM）+ 4 拍片头；卡点音效落在每行开头，
 * 歌声按 `media.voice` 的音节合同合成（5 元音 × 7 起音类）。
 *
 * 渲染：open-mv render films/lyric-mv.ts -o lyric-mv.mp4
 */
import { lyricMv } from '@wae/open-mv';

export default lyricMv({
    width: 1280,
    height: 720,
    fps: 30,
    tempoBpm: 96,
    palette: 'starfield',
    camera: 'push-in',
    title: '夜行',
    titleBeats: 4,
    textStyle: 'lyric-glow',
    hits: true,
    bgm: 0.1,
    grain: 0.05,
    lines: [
        { text: '把夜色折成一条街', beats: 4 },
        { text: '灯一盏一盏退后', beats: 4 },
        { text: '我在节拍里转身', beats: 4, style: 'lyric-big' },
        { text: '让回声替我停留', beats: 4 },
    ],
    voice: {
        syllables: [
            { onset: 'r', vowel: 'a', pitch: 293.66, beats: 2 },
            { vowel: 'o', pitch: 329.63, beats: 2 },
            { onset: 'n', vowel: 'e', pitch: 392.0, beats: 2 },
            { vowel: 'i', pitch: 440.0, beats: 2 },
            { onset: 's', vowel: 'u', pitch: 392.0, beats: 2 },
            { vowel: 'a', pitch: 329.63, beats: 2 },
            { onset: 'r', vowel: 'o', pitch: 293.66, beats: 2 },
            { vowel: 'e', pitch: 261.63, beats: 2 },
        ],
    },
});
