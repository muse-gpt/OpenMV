/**
 * 卡点 MV 示例 ——「四小节」(8 秒)
 *
 * 用 `beatGrid` 做唯一节拍换算：每小节一个场景，每拍一个 tick，
 * 小节头落 impact，收尾一条 riser。画面只用引擎内置图元，
 * 不引入任何外部素材。
 *
 * 渲染：open-mv render films/beat-mv.ts -o beat-mv.mp4
 */
import { Film, bands, grain, shape, text } from '@wae/open-cut';
import { beatGrid } from '@wae/open-mv';

const grid = beatGrid(120, 30);
const BARS = 4;
const ACCENT = '#7aa2ff';
const HOT = '#e8b86d';

const film = new Film({ width: 1280, height: 720, fps: 30 });

for (let bar = 0; bar < BARS; bar++) {
    film.scene({
        duration: grid.barSeconds,
        background: { kind: 'solid', color: bar % 2 === 0 ? '#05070f' : '#0a1024' },
        camera: {
            zoomFrom: 1.0 + bar * 0.02,
            zoomTo: 1.08 + bar * 0.02,
            focusFrom: [0.5, 0.5],
            focusTo: [0.5, 0.47],
            ease: 'in-out-cubic',
        },
        items: [
            bands({ at: 0, dur: grid.barSeconds, count: 2, angle: -10, speed: 38, color: ACCENT, alpha: 0.16, thickness: 300 }),
            shape({
                at: 0,
                dur: grid.barSeconds,
                shape: 'ring',
                x: 0.5,
                y: 0.42,
                w: 0.24 + bar * 0.02,
                h: 0.24 + bar * 0.02,
                color: bar === BARS - 1 ? HOT : ACCENT,
                stroke: 3,
            }),
            text({
                at: 0,
                y: 0.72,
                size: 40,
                bold: true,
                color: '#e9f0fb',
                content: `BAR ${String(bar + 1).padStart(2, '0')}`,
                rise: 18,
                stagger: 2,
                dur: grid.barSeconds,
            }),
            grain({ at: 0, dur: grid.barSeconds, strength: 0.07, density: 12000 }),
        ],
    });
}

const sfx: Array<{ at: number; kind: 'tick' | 'impact' | 'riser'; volume: number; pitch?: number }> = [];
for (let beat = 0; beat < BARS * 4; beat++) {
    const at = grid.secondsOf(beat);
    sfx.push(beat % 4 === 0 ? { at, kind: 'impact', volume: 0.28 } : { at, kind: 'tick', volume: 0.12, pitch: 1.2 });
}
sfx.push({ at: grid.secondsOf(BARS * 4 - 4), kind: 'riser', volume: 0.22 });

film.audio({ bgm: { volume: 0.08 }, sfx });

export default film;
