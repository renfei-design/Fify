export interface OklchColor {
  lightness: number;
  chroma: number;
  hue: number;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Convert OKLCH to WCAG relative luminance through linear sRGB. */
export function relativeLuminance({ lightness, chroma, hue }: OklchColor) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: OklchColor, second: OklchColor) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

/** Extract numeric theme tokens so the gate tests the CSS users receive. */
export function extractOklchThemeTokens(css: string) {
  const tokens: Record<string, OklchColor> = {};
  const pattern =
    /--ui-([a-z-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  for (const match of css.matchAll(pattern))
    tokens[match[1]!] = {
      lightness: Number(match[2]),
      chroma: Number(match[3]),
      hue: Number(match[4]),
    };
  return tokens;
}
