# @wae/open-mv

Song-first music-video authoring on top of the OpenCut engine.

```bash
npm install @wae/open-mv
```

The flow is deliberate and reviewable at every step:

```text
song.wav → analyze (tempo, sections) → plan (shots, camera, lyric style) → render (MP4)
```

## CLI

```bash
open-mv analyze <song.wav> [--out profile.json] [--json]
open-mv plan    <song.wav> [--lines lines.txt] [--sections sections.json] [--profile profile.json] [--out plan.json] [--json]
open-mv render  <film.ts> --out out.mp4 [--json]
open-mv render  --song <song.wav> --out out.mp4 [--lines lines.txt] [--json]
open-mv render  --plan <plan.json> --out out.mp4 [--json]
open-mv verify  [--song <song.wav> | --plan <plan.json>] [--json]
open-mv presets [--json]
open-mv version
```

- `analyze` prints BPM, beat offset and the detected sections. `--out` stores the
  same profile JSON so a reviewed tempo and section list can be reused.
- `plan` prints the storyboard without rendering. `--profile` reads a stored
  analyse profile instead of re-reading the WAV, and `--sections` overrides the
  detected sections with a hand-corrected list. `--out` writes the plan that
  `render --plan` later consumes.
- `render` accepts a film module, a song, or a reviewed plan. The song mode
  analyses, plans and renders in one pass.
- `verify` renders to a temporary file and runs the OpenCut delivery gate:
  frame count, duration, audio level, clipping and scene spans.

Only PCM WAV is accepted as a song; convert other containers first instead of
decoding implicitly. Native analysis and rendering currently ship for Windows
x64.

## License

Apache-2.0.
