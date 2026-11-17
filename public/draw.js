// All values in 1080x1920 px, measured from the After Effects comp. Tune here if something is off.
// cap = height of capital letters (font size is derived from it at runtime).
// scaleX = horizontal stretch, bold = faux-bold stroke as a fraction of cap height (matches the AE look).
export const LAYOUT = {
  font: '"Cossette Titre"',
  color: '#EDEDED',
  scaleX: 1.01, // default; rows may override with their own scaleX
  bold: 0.03,
  left: 193,
  right: 900,
  line1: { baseline: 424, cap: 149 }, // "NOV. 19" + sup
  sup: { cap: 80 },                   // "TH", top aligned to line1 cap top
  line2: { baseline: 586, cap: 149 }, // venue
  info: { baseline: 626, cap: 34, scaleX: 0.97 }, // weekday (left) + date (right)
  bottom: { baseline: 1633, cap: 33, scaleX: 0.97, left: 196, right: 897 }, // 4 words, spread edge to edge
};

let capRatio = 0.7; // cap height / font size, measured once the font is loaded

export async function loadFont() {
  await document.fonts.load(`200px ${LAYOUT.font}`);
  const ctx = new OffscreenCanvas(10, 10).getContext('2d');
  ctx.font = `100px ${LAYOUT.font}`;
  capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100;
}

let cap = 0, sx = 1;
const setFont = (ctx, c) => { cap = c; ctx.font = `${c / capRatio}px ${LAYOUT.font}`; };
const width = (ctx, s) => ctx.measureText(s).width * sx;

// Draws s with its left edge at x (after horizontal scaling) + faux-bold stroke.
function text(ctx, s, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.textAlign = 'left';
  ctx.fillText(s, 0, 0);
  if (LAYOUT.bold) { ctx.lineWidth = cap * LAYOUT.bold; ctx.lineJoin = 'round'; ctx.strokeText(s, 0, 0); }
  ctx.restore();
}

// Sets the font for cap, shrunk if the text is wider than maxW; returns the cap used.
function fit(ctx, s, c, maxW) {
  setFont(ctx, c);
  const w = width(ctx, s);
  if (w > maxW) setFont(ctx, (c * maxW) / w);
  return cap;
}

export function drawOverlay(ctx, f) {
  const L = LAYOUT;
  const W = L.right - L.left;
  ctx.clearRect(0, 0, 1080, 1920);
  ctx.fillStyle = ctx.strokeStyle = L.color;
  ctx.textBaseline = 'alphabetic';

  // Line 1: "NOV. 19" + superscript, right-aligned as a block.
  sx = L.scaleX;
  setFont(ctx, L.sup.cap);
  const supW = width(ctx, f.sup);
  const main1 = `${f.month} ${f.day}`.trim();
  const cap1 = fit(ctx, main1, L.line1.cap, W - supW);
  text(ctx, main1, L.right - supW - width(ctx, main1), L.line1.baseline);
  const supCap = L.sup.cap * (cap1 / L.line1.cap);
  setFont(ctx, supCap);
  text(ctx, f.sup, L.right - width(ctx, f.sup), L.line1.baseline - cap1 + supCap);

  // Line 2: venue.
  fit(ctx, f.venue, L.line2.cap, W);
  text(ctx, f.venue, L.right - width(ctx, f.venue), L.line2.baseline);

  // Weekday / date.
  sx = L.info.scaleX ?? L.scaleX;
  setFont(ctx, L.info.cap);
  text(ctx, f.weekday, L.left, L.info.baseline);
  text(ctx, f.date, L.right - width(ctx, f.date), L.info.baseline);

  // Bottom row: words spread edge to edge.
  sx = L.bottom.scaleX ?? L.scaleX;
  setFont(ctx, L.bottom.cap);
  const words = f.bottom.filter(Boolean);
  if (words.length === 1) return text(ctx, words[0], 540 - width(ctx, words[0]) / 2, L.bottom.baseline);
  const widths = words.map((w) => width(ctx, w));
  const BW = L.bottom.right - L.bottom.left;
  const gap = (BW - widths.reduce((a, b) => a + b, 0)) / (words.length - 1);
  let x = L.bottom.left;
  words.forEach((w, i) => { text(ctx, w, x, L.bottom.baseline); x += widths[i] + gap; });
}
