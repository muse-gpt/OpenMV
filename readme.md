# OpenMV

Music-video authoring: **song-first workflow + presets + skills**. The rendering
engine is exactly OpenCut.

OpenMV does not copy a player, synthesizer or encoder — picture, mixing and MP4
output all run in the OpenCut engine. It only adds what an MV needs: song
analysis, storyboard scripts, palettes, camera moves, lyric styles, beat grids
and authoring skills for agents.

## Workflow: MV runs opposite to a short film

```
AI short film: script → code → music        (generate video from a script)
AI MV:         song → musical structure → script matched to the song → picture
```

A short film starts from a script with music as score; an MV starts from an
existing song, and the picture has to obey that music. The entry point is
`analyze`, the intermediate artifact is a **reviewable storyboard script**, and
only then come `compile` and `render`:

```
song.wav ──analyze──> SongProfile ──planSongMv──> SongMvPlan ──compileSongMv──> Film ──> MP4
                      (BPM/beat offset/          (shots/camera/lyric            (OpenCut)
                       sections/energy)           styles/lyric lines)
```

The script is plain data: print it, retime it, swap camera moves, then compile.
Changing the song structure never requires rewriting picture code.

| Layer | Owner |
| --- | --- |
| Rendering engine, scene IR, sound/voice synthesis, encoding | OpenCut (`@wae/open-cut`) and the shared `media.*` core |
| Song analysis, storyboard scripts, MV presets and builders | `@wae/open-mv` in this repository |
| MV authoring methodology | `packages/open-mv-skills` in this repository |

## Quick start

```bash
pnpm install
pnpm build
pnpm presets                     # palette / camera / lyric-style catalogue
pnpm analyze song.wav            # BPM, beat offset, sections and energy
pnpm render:song                 # -> song-mv.mp4 (24s, song-first flow)
pnpm render:lyric                # -> lyric-mv.mp4 (12.5s, direct lyric compile)
pnpm render:beat                 # -> beat-mv.mp4 (8s, per-beat hits)
```

Local development links `@wae/open-cut` to a sibling OpenCut checkout, so you
need:

1. an `OpenCut` checkout next to this repository;
2. OpenCut's `packages/open-cut` built (`pnpm build:ts`);
3. OpenCut's native binding built and staged (`pnpm build:napi`).

For npm publishing, replace the `link:` spec with a version — no code changes.

## Song → script → film

```ts
import { analyzeWav, planSongMv, compileSongMv } from '@wae/open-mv';

const song = analyzeWav('song.wav');          // 1. song facts
const plan = planSongMv({                      // 2. storyboard script (printable)
    song,
    palette: 'dusk-film',
    lines: ['Write the name into the archive', 'I rewrite it in the chorus'],
});
console.log(JSON.stringify(plan, null, 2));    //    the script is plain data
export default compileSongMv(plan, { grain: 0.05 }); // 3. compile into a Film
```

Render with `open-mv render films/song-mv.ts -o out.mp4`.

Script rules (fixed and predictable):

- One shot per song section; the camera move follows section kind and energy:
  high-energy chorus `rise`, chorus `settle`, intro/outro `pull-out`, verse
  alternates `push-in` / `drift-left`.
- Lyric style follows the section too: chorus `lyric-glow` (`lyric-big` when
  energy ≥ 0.85), intro/outro `caption`, verse uses the default.
- Lyric lines are distributed across shots in proportion to duration (largest
  remainder), with optional per-line style overrides.
- Hits: one `tick` per bar, one `impact` at every chorus start and one `riser`
  one beat before it.

`lyricMv({ lines, tempoBpm, ... })` remains the shortcut when you do not want to
analyze a song first.

## Song analysis contract

- Only **PCM WAV** (16/24-bit integer or 32-bit float). Convert other containers
  to WAV first: no implicit decoding and no guessed sample rate.
- Fully deterministic: short-time energy → onset strength → autocorrelation
  tempo detection (parabolic interpolation) → beat phase → bar segmentation by
  the loudest 10% frames. No randomness, no trained model.
- Section kinds are **heuristics, not facts**: the script is data, so adjust
  section boundaries or kinds after listening before compiling.
- Boundaries align to bars; a half-bar crossing a boundary joins the closer
  side. Very short first/last sections are kept (short intros/outros are real),
  short internal runs merge into a neighbour.

## Presets and skills

- Presets: `PALETTES` (6), `CAMERA_MOVES` (6), `TEXT_STYLES` (5), plus
  `beatGrid` / `lyricMv` / `divider`. Ids are a stable contract.
- **Theme = color card**: `paletteDesign()` compiles a palette into a
  project-level semantic card and `paletteBackground()` emits only `$bg0` /
  `$bg1` role references; lyric text and glow use `$ink` / `$accent` / `$glow`.
  Switching palettes swaps the card without touching items or render code, and
  scene-level overrides follow the same resolution and locking rules.
- Drums: `lyricMv` and `compileSongMv` accept `drums: '<pattern>'` (for example
  `four-on-floor`, `half-time`, `lofi`) and fill the film at the song BPM; both
  timbre and pattern come from the shared synthesis core (17 instruments, 8
  grooves) with no audio assets.
- Skills: `packages/open-mv-skills` — song (analysis and script), director
  (overall mood and energy curve), lyric (line scheduling and styles), beat
  (hits and sound placement).
- See `packages/open-mv-skills/open-mv-director/references/presets.md` for the
  catalogue details.

## Current boundaries

- Hard cuts between scenes; the engine has no transitions or multi-track
  compositing.
- Synthesized singing covers 5 vowels × 7 onset classes and cannot sing
  arbitrary lyrics word by word; use imported audio for real voices.
- Song analysis gives a structural first draft, not a guarantee for every
  genre; it does not analyze key, chords or timbre.
- No asset library; provide image/video paths yourself.
- Acceptance relies on real render inspection (`ffmpeg -af volumedetect` plus
  frame grabs), never on "a file was produced".

## Examples

- `films/song-mv.ts` — song-first: song structure → storyboard → film (24s).
- `films/lyric-mv.ts` — direct lyric compile: one intro + four lyric lines with
  synthesized singing and hits (12.5s).
- `films/beat-mv.ts` — per-beat hits: four bars, one tick per beat, an impact at
  every bar start and a closing riser (8s).

## License

Apache-2.0, see [License.md](License.md).
