/**
 * MV presets: palettes, camera moves and lyric styles.
 *
 * A preset only describes executable authoring intent (color, framing, motion,
 * size and entrance), never a title, director or reference film as a style
 * parameter. Every value maps to a field OpenCut already supports, so preset
 * upgrades never require engine changes.
 */
import type { Background, DesignSpec, Ease } from '@wae/open-cut';

/** One MV palette: background + four text roles + a glow color. */
export interface MvPalette {
    id: string;
    label: string;
    background: Background;
    /** Primary lyric / title. */
    ink: string;
    /** Secondary text and lines. */
    accent: string;
    /** Emphasis words and highlights. */
    hot: string;
    /** Captions and credits. */
    dim: string;
    /** Glow color used by the `glow` primitive. */
    glow: string;
}

/** One camera move: start/end zoom, focus and easing. */
export interface MvCamera {
    id: string;
    label: string;
    zoomFrom: number;
    zoomTo: number;
    focusFrom: [number, number];
    focusTo: [number, number];
    ease: Ease;
}

/** Lyric style: size, color role, entrance rise and stagger. */
export interface MvTextStyle {
    id: string;
    label: string;
    size: number;
    bold?: boolean;
    /** Color role resolved from the palette at render time. */
    color: 'ink' | 'hot' | 'accent' | 'dim';
    /** Per-glyph rise in pixels. */
    rise?: number;
    /** Stagger in frames between two glyphs. */
    stagger?: number;
    /** Whether to add one palette glow layer. */
    glow?: boolean;
    align?: 'left' | 'center' | 'right';
}

export const PALETTES: readonly MvPalette[] = [
    {
        id: 'neon-night',
        label: '霓虹夜',
        background: { kind: 'v-gradient', colors: ['#070c18', '#1b2545', '#04060d'] },
        ink: '#e9f0fb',
        accent: '#7aa2ff',
        hot: '#e8b86d',
        dim: '#8fa3c8',
        glow: '#2b4d95',
    },
    {
        id: 'dusk-film',
        label: '暮色胶片',
        background: { kind: 'v-gradient', colors: ['#1a1108', '#3a2415', '#0a0603'] },
        ink: '#f6ead8',
        accent: '#d9a066',
        hot: '#f0c070',
        dim: '#b09a80',
        glow: '#6b3f1d',
    },
    {
        id: 'mono-ink',
        label: '墨白',
        background: { kind: 'solid', color: '#0b0b0c' },
        ink: '#f2f2f2',
        accent: '#b9bcc2',
        hot: '#ffffff',
        dim: '#7f848c',
        glow: '#3a3d42',
    },
    {
        id: 'cyber-lime',
        label: '赛博青柠',
        background: { kind: 'radial', center: '#12251a', edge: '#04080a' },
        ink: '#eafff2',
        accent: '#6fd6a4',
        hot: '#c8ff4d',
        dim: '#7ba393',
        glow: '#1f6b46',
    },
    {
        id: 'sakura',
        label: '樱夜',
        background: { kind: 'v-gradient', colors: ['#1b0f18', '#3a1f30', '#0b060a'] },
        ink: '#ffeef6',
        accent: '#f2a6c8',
        hot: '#ffd166',
        dim: '#c99bb0',
        glow: '#7a2f52',
    },
    {
        id: 'starfield',
        label: '星野',
        background: { kind: 'starfield', base: ['#04060f', '#0a1226'], stars: 320, drift: 0.4, twinkle: 0.6 },
        ink: '#eaf1ff',
        accent: '#9db8ff',
        hot: '#ffd89b',
        dim: '#8296b8',
        glow: '#31457a',
    },
];

export const CAMERA_MOVES: readonly MvCamera[] = [
    { id: 'push-in', label: '缓推', zoomFrom: 1.0, zoomTo: 1.08, focusFrom: [0.5, 0.5], focusTo: [0.5, 0.48], ease: 'in-out-cubic' },
    { id: 'pull-out', label: '缓拉', zoomFrom: 1.1, zoomTo: 1.0, focusFrom: [0.5, 0.52], focusTo: [0.5, 0.5], ease: 'out-cubic' },
    { id: 'drift-left', label: '左移', zoomFrom: 1.06, zoomTo: 1.04, focusFrom: [0.56, 0.5], focusTo: [0.46, 0.5], ease: 'in-out-sine' },
    { id: 'drift-right', label: '右移', zoomFrom: 1.06, zoomTo: 1.04, focusFrom: [0.44, 0.5], focusTo: [0.54, 0.5], ease: 'in-out-sine' },
    { id: 'rise', label: '上摇', zoomFrom: 1.02, zoomTo: 1.1, focusFrom: [0.5, 0.58], focusTo: [0.5, 0.44], ease: 'in-out-quart' },
    { id: 'settle', label: '落定', zoomFrom: 1.14, zoomTo: 1.0, focusFrom: [0.5, 0.54], focusTo: [0.5, 0.5], ease: 'out-quint' },
];

export const TEXT_STYLES: readonly MvTextStyle[] = [
    { id: 'lyric-clean', label: '干净歌词', size: 46, bold: true, color: 'ink', rise: 14, stagger: 1 },
    { id: 'lyric-glow', label: '辉光歌词', size: 52, bold: true, color: 'ink', rise: 20, stagger: 2, glow: true },
    { id: 'lyric-big', label: '大字歌词', size: 76, bold: true, color: 'hot', rise: 24, stagger: 2 },
    { id: 'caption', label: '说明小字', size: 26, color: 'dim', rise: 8, stagger: 1 },
    { id: 'title-stack', label: '标题叠字', size: 92, bold: true, color: 'ink', rise: 30, stagger: 3, glow: true },
];

export function paletteById(id: string): MvPalette {
    const palette = PALETTES.find((entry) => entry.id === id);
    if (!palette) {
        throw new Error(`unknown palette \`${id}\` (${PALETTES.map((entry) => entry.id).join(' | ')})`);
    }
    return palette;
}

export function cameraById(id: string): MvCamera {
    const camera = CAMERA_MOVES.find((entry) => entry.id === id);
    if (!camera) {
        throw new Error(`unknown camera \`${id}\` (${CAMERA_MOVES.map((entry) => entry.id).join(' | ')})`);
    }
    return camera;
}

export function textStyleById(id: string): MvTextStyle {
    const style = TEXT_STYLES.find((entry) => entry.id === id);
    if (!style) {
        throw new Error(`unknown text style \`${id}\` (${TEXT_STYLES.map((entry) => entry.id).join(' | ')})`);
    }
    return style;
}

/** Resolves a color role from the palette; styles and primitives share this lookup. */
export function paletteColor(palette: MvPalette, role: MvTextStyle['color']): string {
    return palette[role];
}

/**
 * Palette → semantic color card.
 *
 * MV preset colors no longer live on every primitive: compilation declares the
 * palette as a project-level `design` card and the picture references roles such
 * as `$ink`, `$accent` and `$bg0`. Switching themes means switching the card,
 * without touching a single item or fighting scene-level overrides.
 */
export function paletteDesign(palette: MvPalette): DesignSpec {
    const colors: NonNullable<DesignSpec['colors']> = [
        { role: 'ink', value: palette.ink },
        { role: 'accent', value: palette.accent },
        { role: 'hot', value: palette.hot },
        { role: 'dim', value: palette.dim },
        { role: 'glow', value: palette.glow },
    ];
    const background = palette.background;
    switch (background.kind) {
        case 'solid':
            colors.push({ role: 'bg0', value: background.color });
            break;
        case 'v-gradient':
            background.colors.forEach((color, index) => colors.push({ role: `bg${index}`, value: color }));
            break;
        case 'radial':
            colors.push({ role: 'bg0', value: background.center }, { role: 'bg1', value: background.edge });
            break;
        case 'starfield':
            background.base.forEach((color, index) => colors.push({ role: `bg${index}`, value: color }));
            if (background.tint) {
                colors.push({ role: 'bg-tint', value: background.tint });
            }
            break;
    }
    return { colors };
}

/** Palette → background that only references `$bg*` roles; pair with {@link paletteDesign}. */
export function paletteBackground(palette: MvPalette): Background {
    const background = palette.background;
    switch (background.kind) {
        case 'solid':
            return { kind: 'solid', color: '$bg0' };
        case 'v-gradient':
            return { kind: 'v-gradient', colors: background.colors.map((_, index) => `$bg${index}`) };
        case 'radial':
            return { kind: 'radial', center: '$bg0', edge: '$bg1' };
        case 'starfield':
            return {
                ...background,
                base: background.base.map((_, index) => `$bg${index}`),
                tint: background.tint ? '$bg-tint' : undefined,
            };
    }
}
