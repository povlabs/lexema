// The card's colours, read off the page's own role tokens.
//
// The nine roles are declared once, as oklch, in the `@theme` block of
// web/app/globals.css (design-system-manifest.md § "Role tokens"). Satori and
// resvg paint with sRGB and do not read oklch, so the card takes each role it
// uses from that block and writes it as the sRGB hex it stands for. Nothing
// here holds a colour of its own: change a role there and the card follows.

/** The roles a card paints with, each by the name globals.css gives it. */
export const CARD_ROLES = {
  surface: "surface",
  textStrong: "text-strong",
  text: "text",
  textMuted: "text-muted",
  accent: "accent",
} as const;
export type Palette = Readonly<Record<keyof typeof CARD_ROLES, string>>;

const channel = (linear: number): string => {
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
    .toString(16)
    .padStart(2, "0");
};

/**
 * An oklch colour as sRGB hex: Björn Ottosson's OKLab matrices
 * (https://bottosson.github.io/posts/oklab/), then the sRGB transfer curve.
 */
export function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${[
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
    .map(channel)
    .join("")}`;
}

const DECLARATION = /--color-([a-z-]+):\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)deg\s*\)/g;

/** Each role the card uses, from the stylesheet's text; throws when one is missing. */
export function paletteOf(css: string): Palette {
  const declared = new Map<string, string>();
  for (const [, role, lightness, chroma, hue] of css.matchAll(DECLARATION)) {
    declared.set(role, oklchToHex(Number(lightness) / 100, Number(chroma), Number(hue)));
  }
  const entries = Object.entries(CARD_ROLES).map(([key, role]) => {
    const hex = declared.get(role);
    if (hex === undefined) throw new Error(`globals.css declares no --color-${role} in oklch`);
    return [key, hex] as const;
  });
  return Object.fromEntries(entries) as Record<keyof typeof CARD_ROLES, string>;
}
