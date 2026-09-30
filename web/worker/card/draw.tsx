// Drawing a card (#304): board S1 in lexema-design.pen, as Satori lays it out
// and resvg paints it into a 1200×630 PNG. What the card says is decided in
// web/lib/dictionary/card.ts; this file only lays it out.
//
// Satori styles with inline style objects and nothing else, which is why the
// drawing lives here, beside the Worker, and not with the page's components.
// Its colours are the page's role tokens (palette.ts) and its faces the page's
// three families (web/fonts/card/); the sizes and spacing are the board's.
//
// Satori and resvg arrive as `CardInk.engine`, because each ships one build per
// runtime and a bundler resolving the bare name can pick the wrong one: the
// Worker's build picked the Node one, whose wasm is inlined as base64
// (desk.ts). The Worker hands in the workerd builds; a test, the Node ones.

import type { satori as Satori, Font } from "@cf-wasm/satori";
import type { Resvg } from "@cf-wasm/resvg";
import type { CSSProperties, ReactNode } from "react";
import { CARD_HEIGHT, CARD_WIDTH, type Card, type WordCard } from "@/lib/dictionary/card.ts";
import { SITE_NAME, SITE_PRONUNCIATION, SITE_TAGLINE } from "@/lib/dictionary/params.ts";
import { ORIGIN } from "../hosts.ts";
import type { Palette } from "./palette.ts";

const SERIF = "Spectral";
const SANS = "Inter";
const MONO = "IBM Plex Mono";

/** The board's inset: the text column starts 80px in, top and bottom rows 64px from the edge. */
const INSET_X = 80;
const INSET_Y = 64;
const COLUMN = CARD_WIDTH - 2 * INSET_X;

/**
 * The headword's sizes, largest first. It takes the largest whose one line
 * fits the column: `casa` at 128px, `precipitevolissimevolmente` at 72px, as
 * the board draws them. Past the last step a word wraps rather than shrink
 * further; no Italian headword the release holds gets there.
 */
export const HEADWORD_SIZES = [128, 96, 72, 56, 44] as const;

/** Where a card's words end up; the site's own host, in the accent. */
const SITE_HOST = new URL(ORIGIN.lexema).host;

/** The layout engine and the rasteriser, as one runtime's build of each. */
export interface CardEngine {
  satori: typeof Satori;
  Resvg: typeof Resvg;
}

/** Everything a drawing needs besides the card: the engine, the faces and the role colours. */
export interface CardInk {
  engine: CardEngine;
  fonts: Font[];
  palette: Palette;
}

function Frame({ palette, children }: { palette: Palette; children: ReactNode }) {
  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
        padding: `${INSET_Y}px ${INSET_X}px`,
        backgroundColor: palette.surface,
        color: palette.text,
      }}
    >
      {children}
    </div>
  );
}

function Footer({ palette }: { palette: Palette }) {
  return <div style={{ display: "flex", fontFamily: SANS, fontSize: 22, color: palette.accent }}>{SITE_HOST}</div>;
}

/** The middle of a card: centred between its top row and its footer. */
const MIDDLE: CSSProperties = { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" };

/**
 * One part of a line: its text, its face, and how far it is raised to sit on
 * the line's baseline. Satori aligns a row's text by its boxes, not its
 * baselines, so a part in a smaller or different face is lifted by the
 * difference, measured against the board.
 */
interface Part {
  text: string;
  face: CSSProperties;
  lift: number;
}

/** One line of parts, ` · ` between them. */
function PartsLine({ parts, dot, marginTop }: { parts: Part[]; dot: Part; marginTop: number }) {
  if (parts.length === 0) return null;
  const span = ({ text, face, lift }: Part, key: string, spaced = false) => (
    <span key={key} style={{ ...face, position: "relative", top: -lift, ...(spaced ? { margin: "0 14px" } : {}) }}>
      {text}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginTop }}>
      {parts.flatMap((part, i) => [...(i === 0 ? [] : [span(dot, `dot-${i}`, true)]), span(part, `part-${i}`)])}
    </div>
  );
}

function MetaLine({ card, palette }: { card: WordCard; palette: Palette }) {
  const sans: CSSProperties = { fontFamily: SANS, fontSize: 26 };
  const parts: Part[] = [];
  if (card.pronunciation !== undefined) {
    parts.push({ text: card.pronunciation, face: { fontFamily: MONO, fontSize: 24, color: palette.textMuted }, lift: 0 });
  }
  if (card.gender !== undefined) parts.push({ text: card.gender, face: { ...sans, color: palette.textMuted }, lift: 5 });
  if (card.partOfSpeech !== undefined) {
    parts.push({ text: card.partOfSpeech, face: { ...sans, fontWeight: 600, color: palette.textStrong }, lift: 5 });
  }
  const dot: Part = { text: "·", face: { ...sans, color: palette.textMuted }, lift: 5 };
  return <PartsLine parts={parts} dot={dot} marginTop={21} />;
}

function WordCardView({ card, palette, headwordSize }: { card: WordCard; palette: Palette; headwordSize: number }) {
  return (
    <Frame palette={palette}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: SERIF, fontSize: 30, color: palette.textStrong }}>{SITE_NAME}</span>
        <span style={{ fontFamily: SANS, fontSize: 20, color: palette.textMuted }}>{SITE_TAGLINE}</span>
      </div>
      <div style={MIDDLE}>
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: headwordSize, lineHeight: 1, color: palette.textStrong }}>
          {card.headword}
        </div>
        <MetaLine card={card} palette={palette} />
        {card.meaning !== undefined && (
          <div
            style={{
              display: "block",
              lineClamp: 2,
              marginTop: 17,
              fontFamily: SERIF,
              fontSize: 40,
              lineHeight: "52px",
              color: palette.text,
            }}
          >
            {card.meaning}
          </div>
        )}
      </div>
      <Footer palette={palette} />
    </Frame>
  );
}

function HomeCardView({ palette }: { palette: Palette }) {
  return (
    <Frame palette={palette}>
      {/* The board sets the home block 23px below the middle a word card's sits in. */}
      <div style={{ ...MIDDLE, paddingTop: 46 }}>
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: 128, lineHeight: 1, color: palette.textStrong }}>
          {SITE_NAME}
        </div>
        <PartsLine
          marginTop={20}
          dot={{ text: "·", face: { fontFamily: SANS, fontSize: 26, color: palette.textMuted }, lift: 15 }}
          parts={[
            { text: SITE_PRONUNCIATION, face: { fontFamily: MONO, fontSize: 24, color: palette.textMuted }, lift: 9 },
            { text: SITE_TAGLINE, face: { fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: palette.text }, lift: 0 },
          ]}
        />
      </div>
      <Footer palette={palette} />
    </Frame>
  );
}

/** How wide the headword's one line is at `size`, as Satori lays it out. */
async function headwordWidth(headword: string, size: number, { engine, fonts }: CardInk): Promise<number> {
  let width = 0;
  await engine.satori(<div style={{ display: "flex", fontFamily: SERIF, fontSize: size, lineHeight: 1 }}>{headword}</div>, {
    height: size,
    fonts,
    onNodeDetected: (node) => {
      width = Math.max(width, node.width);
    },
  });
  return width;
}

/** The largest of `HEADWORD_SIZES` at which the headword fits on one line. */
export async function headwordSizeOf(headword: string, ink: CardInk): Promise<number> {
  const [largest] = HEADWORD_SIZES;
  const width = await headwordWidth(headword, largest, ink);
  // Text scales with its size, so one measurement answers every step.
  return HEADWORD_SIZES.find((size) => (width * size) / largest <= COLUMN) ?? HEADWORD_SIZES[HEADWORD_SIZES.length - 1];
}

/** The card as SVG, laid out by Satori. */
export async function cardSvg(card: Card, ink: CardInk): Promise<string> {
  const { engine, fonts, palette } = ink;
  const tree =
    card.kind === "home" ? (
      <HomeCardView palette={palette} />
    ) : (
      <WordCardView card={card} palette={palette} headwordSize={await headwordSizeOf(card.headword, ink)} />
    );
  return engine.satori(tree, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts });
}

/** The card as a 1200×630 PNG. */
export async function drawCard(card: Card, ink: CardInk): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await cardSvg(card, ink);
  // resvg copies the PNG out of wasm memory into a fresh, plain ArrayBuffer.
  return new ink.engine.Resvg(svg, { fitTo: { mode: "original" } }).render().asPng() as Uint8Array<ArrayBuffer>;
}
