// One oklch colour, read from the text `globals.css` declares it in, and the
// sRGB hex it paints as.
//
// The tokens test compares the stylesheet's role colours with the design file's
// hex, and this conversion is what lets the two be compared at all. A wrong
// conversion would make both sides agree while both are wrong, so it carries
// its own test on known pairs in `oklch.test.ts`.
//
// The maths is Björn Ottosson's OKLab definition
// (https://bottosson.github.io/posts/oklab/), the same one CSS Color 4 uses for
// `oklch()`: polar to OKLab, OKLab to linear sRGB, then the sRGB transfer curve.

/** The forms `globals.css` writes: `oklch(17.84% 0.0026 67.7deg)`, lightness as a percentage or a 0–1 number. */
const OKLCH = /^oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)(deg)?\s*\)$/;

export class Oklch {
  private constructor(
    /** Lightness, 0 to 1. */
    readonly lightness: number,
    /** Chroma, 0 or more. */
    readonly chroma: number,
    /** Hue in degrees. */
    readonly hue: number,
  ) {}

  /** Reads one `oklch(...)` value, or throws naming the text it could not read. */
  static parse(text: string): Oklch {
    const match = OKLCH.exec(text.trim());
    if (!match) throw new Error(`not an oklch() colour: ${text}`);
    const [, l, percent, c, h] = match;
    const lightness = Number(l) / (percent ? 100 : 1);
    const chroma = Number(c);
    const hue = Number(h);
    if (![lightness, chroma, hue].every(Number.isFinite) || lightness > 1) {
      throw new Error(`not an oklch() colour: ${text}`);
    }
    return new Oklch(lightness, chroma, hue);
  }

  /**
   * The colour as `#RRGGBB`, upper case like the design file writes it.
   *
   * Throws when the colour lies outside sRGB by more than rounding can absorb:
   * clamping it would invent a hex the stylesheet never meant.
   */
  toHex(): string {
    const radians = (this.hue * Math.PI) / 180;
    const a = this.chroma * Math.cos(radians);
    const b = this.chroma * Math.sin(radians);

    const l = (this.lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (this.lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (this.lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

    const linear = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];

    return `#${linear.map((channel) => byte(channel, this)).join("")}`;
  }
}

/** One linear-light channel as two hex digits, through the sRGB transfer curve. */
function byte(linear: number, colour: Oklch): string {
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const value = Math.round(encoded * 255);
  if (value < 0 || value > 255) {
    throw new Error(
      `oklch(${colour.lightness} ${colour.chroma} ${colour.hue}) lies outside sRGB`,
    );
  }
  return value.toString(16).toUpperCase().padStart(2, "0");
}
