// All values in 1080x1920 px, measured on the reference layout PNG. Tune here if something is off.
// cap = height of capital letters (font size is derived from it), baseline = bottom of capitals,
// left/right = ink edges of the row, scaleX = horizontal stretch of the letters.
export const LAYOUT = {
  font: '"Cossette Titre"',
  color: '#DEDEDE',
  weight: 700, // 400 = Regular, 700 = Bold
  line1: { baseline: 459, cap: 150, right: 890, scaleX: 0.952 }, // "NOV. 19" + sup
  sup: { cap: 87, gap: 5 },                                  // "TH": top aligned to line1, gap = space before it
  line2: { baseline: 622, cap: 150, right: 896, scaleX: 0.956, minLeft: 192 }, // venue
  info: { baseline: 666, cap: 30, left: 192, right: 894, scaleX: 0.94 },     // weekday (left) + date (right)
  bottom: { baseline: 1670, cap: 30, left: 195, right: 894, scaleX: 0.93 },  // 4 words, spread edge to edge
};

let capRatio = 0.7; // cap height / font size, measured once the font is loaded

// text = every string about to be drawn, so all needed glyphs are loaded. Throws if the font is unavailable.
export async function loadFont(text = 'A') {
  const f = `${LAYOUT.weight} 200px ${LAYOUT.font}`;
  await document.fonts.load(f, text);
  if (!document.fonts.check(f, text)) throw new Error('Font Cossette Titre non caricato');
  const ctx = new OffscreenCanvas(10, 10).getContext('2d');
  ctx.font = `${LAYOUT.weight} 100px ${LAYOUT.font}`;
  capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100;
}

let sx = 1;
const setFont = (ctx, cap, scaleX = 1) => { sx = scaleX; ctx.font = `${LAYOUT.weight} ${cap / capRatio}px ${LAYOUT.font}`; };
// Ink box of s (scaled): width and offset of the ink's left edge from the pen position.
function ink(ctx, s) {
  const m = ctx.measureText(s);
  return { w: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * sx, off: m.actualBoundingBoxLeft * sx };
}

// Draws s with its ink's left edge at x.
function text(ctx, s, x, y) {
  ctx.save();
  ctx.translate(x + ink(ctx, s).off, y);
  ctx.scale(sx, 1);
  ctx.textAlign = 'left';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

// Sets the font for the row, shrunk if the ink is wider than maxW; returns the cap used.
function fit(ctx, s, row, maxW) {
  setFont(ctx, row.cap, row.scaleX);
  const w = ink(ctx, s).w;
  if (w <= maxW) return row.cap;
  setFont(ctx, (row.cap * maxW) / w, row.scaleX);
  return (row.cap * maxW) / w;
}

export function drawOverlay(ctx, f) {
  const L = LAYOUT;
  ctx.clearRect(0, 0, 1080, 1920);
  ctx.fillStyle = L.color;
  ctx.textBaseline = 'alphabetic';

  // Line 1: "NOV. 19" + superscript, right-aligned as a block.
  const main1 = `${f.month} ${f.day}`.trim();
  setFont(ctx, L.sup.cap, L.line1.scaleX);
  const supW = f.sup ? ink(ctx, f.sup).w + L.sup.gap : 0;
  const cap1 = fit(ctx, main1, L.line1, L.line1.right - L.line2.minLeft - supW);
  text(ctx, main1, L.line1.right - supW - ink(ctx, main1).w, L.line1.baseline);
  if (f.sup) {
    const supCap = L.sup.cap * (cap1 / L.line1.cap);
    setFont(ctx, supCap, L.line1.scaleX);
    text(ctx, f.sup, L.line1.right - ink(ctx, f.sup).w, L.line1.baseline - cap1 + supCap);
  }

  // Line 2: venue.
  fit(ctx, f.venue, L.line2, L.line2.right - L.line2.minLeft);
  text(ctx, f.venue, L.line2.right - ink(ctx, f.venue).w, L.line2.baseline);

  // Weekday / date.
  setFont(ctx, L.info.cap, L.info.scaleX);
  text(ctx, f.weekday, L.info.left, L.info.baseline);
  text(ctx, f.date, L.info.right - ink(ctx, f.date).w, L.info.baseline);

  // Bottom row: words spread edge to edge.
  const B = L.bottom;
  setFont(ctx, B.cap, B.scaleX);
  const words = f.bottom.filter(Boolean);
  if (words.length === 1) return text(ctx, words[0], 540 - ink(ctx, words[0]).w / 2, B.baseline);
  const widths = words.map((w) => ink(ctx, w).w);
  const gap = (B.right - B.left - widths.reduce((a, b) => a + b, 0)) / (words.length - 1);
  let x = B.left;
  words.forEach((w, i) => { text(ctx, w, x, B.baseline); x += widths[i] + gap; });
}
