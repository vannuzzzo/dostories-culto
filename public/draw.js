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
  // Partner logos (transparent PNGs), row just above the bottom text.
  logos: { bottom: 1590, height: 120, gap: 40, left: 195, right: 894 },
  // Venue hidden: date block moves up (baselines of "NOV. 11" and weekday/date).
  compact: { line1: 402, info: 445 },
  // Line-up mode: DJ names in the middle.
  lineup: {
    label: { baseline: 940, cap: 30, scaleX: 0.94 },         // "DJ"
    names: { baseline: 1102, cap: 150, step: 162, scaleX: 0.956, maxLines: 3 }, // one name line per row
    times: { gap: 43, cap: 30, scaleX: 0.94 },               // "FROM 22:00" / "TILL END", gap below last name
  },
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
let size = 1; // text size of the block being drawn (its own slider); every cap below is multiplied by it
const setFont = (ctx, cap, scaleX = 1) => { sx = scaleX; ctx.font = `${LAYOUT.weight} ${(cap * size) / capRatio}px ${LAYOUT.font}`; };
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

// sizes = [{w, h}] natural image sizes → [{x, y, w, h}] in story px.
// 1 logo: centered. More: spread edge to edge like the bottom words. Row shrinks if it doesn't fit.
export function layoutLogos(sizes, row) {
  if (!sizes.length) return [];
  const W = row.right - row.left;
  const widths = sizes.map((s) => (s.w * row.height) / s.h);
  // The minimum gap never shrinks, only the logos do.
  const k = Math.min(1, (W - row.gap * (sizes.length - 1)) / widths.reduce((a, b) => a + b, 0));
  const h = row.height * k;
  const y = row.bottom - row.height / 2 - h / 2;
  if (sizes.length === 1) return [{ x: row.left + (W - widths[0] * k) / 2, y, w: widths[0] * k, h }];
  const gap = (W - widths.reduce((a, b) => a + b * k, 0)) / (sizes.length - 1);
  let x = row.left;
  return widths.map((w) => { const o = { x, y, w: w * k, h }; x += w * k + gap; return o; });
}

// In-place on RGBA pixels. 'bw' = grayscale (saturation 0), 'bwText' = grayscale whose white is #DEDEDE,
// 'white'/'text'/'black' = solid silhouette.
export function recolor(px, mode) {
  const light = mode === 'bwText' || mode === 'text' ? 0xde : 255; // 0xDE = #DEDEDE, the text color
  for (let i = 0; i < px.length; i += 4) {
    const v = mode === 'white' || mode === 'text' ? light : mode === 'black' ? 0
      : ((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) * light) / 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
}

export function drawOverlay(ctx, f) {
  const L = LAYOUT;
  ctx.clearRect(0, 0, 1080, 1920);
  size = f.topSize ?? 1; // date / venue block
  ctx.fillStyle = L.color;
  ctx.textBaseline = 'alphabetic';

  const U = L.lineup;
  // Vertical distances from an anchor scale with the text size, so rows never collide.
  const at = (anchor, y) => anchor - (anchor - y) * size;
  const yInfo = f.showVenue ? L.info.baseline : L.compact.info; // top block grows upward from weekday/date
  const y1 = at(yInfo, f.showVenue ? L.line1.baseline : L.compact.line1);

  // Line 1: "NOV. 19" + superscript, right-aligned as a block.
  const main1 = `${f.month} ${f.day}`.trim();
  setFont(ctx, L.sup.cap, L.line1.scaleX);
  const supW = f.sup ? ink(ctx, f.sup).w + L.sup.gap : 0;
  const cap1 = fit(ctx, main1, L.line1, L.line1.right - L.line2.minLeft - supW);
  text(ctx, main1, L.line1.right - supW - ink(ctx, main1).w, y1);
  if (f.sup) {
    const supCap = L.sup.cap * (cap1 / L.line1.cap);
    setFont(ctx, supCap, L.line1.scaleX);
    text(ctx, f.sup, L.line1.right - ink(ctx, f.sup).w, y1 - (cap1 - supCap) * size);
  }

  // Weekday / date.
  setFont(ctx, L.info.cap, L.info.scaleX);
  text(ctx, f.weekday, L.info.left, yInfo);
  text(ctx, f.date, L.info.right - ink(ctx, f.date).w, yInfo);

  if (f.lineup) {
    size = f.djSize ?? 1;
    // Label, names (left-aligned, one per row), then from/till row.
    const W = L.info.right - L.info.left;
    const names = f.names.filter(Boolean);
    // More rows than maxLines: shrink the whole block so it never reaches the bottom row.
    const k = Math.min(1, U.names.maxLines / Math.max(1, names.length));
    setFont(ctx, U.label.cap, U.label.scaleX);
    const top = U.names.baseline - U.names.cap; // the line-up block grows downward from here
    const yLabel = at(top, U.label.baseline);
    if (f.label) text(ctx, f.label, L.info.left, yLabel);
    // Top of the first name stays put; line spacing follows the text size.
    let y = top + U.names.cap * k * size;
    names.forEach((n, i) => {
      if (i) y += U.names.step * k * size;
      fit(ctx, n, { cap: U.names.cap * k, scaleX: U.names.scaleX }, W);
      text(ctx, n, L.info.left, y);
    });
    y = (names.length ? y : yLabel) + U.times.gap * size;
    setFont(ctx, U.times.cap, U.times.scaleX);
    if (f.from) text(ctx, f.from, L.info.left, y);
    if (f.till) text(ctx, f.till, L.info.right - ink(ctx, f.till).w, y);
  }

  if (f.showVenue) {
    size = f.topSize ?? 1;
    // Line 2: venue.
    fit(ctx, f.venue, L.line2, L.line2.right - L.line2.minLeft);
    text(ctx, f.venue, L.line2.right - ink(ctx, f.venue).w, at(yInfo, L.line2.baseline));
  }

  const imgs = f.logos ?? [];
  // Sources are <img> (original) or <canvas> (recolored).
  layoutLogos(imgs.map((i) => ({ w: i.naturalWidth || i.width, h: i.naturalHeight || i.height })), { ...L.logos, height: f.logoHeight ?? L.logos.height })
    .forEach((o, i) => ctx.drawImage(imgs[i], o.x, o.y, o.w, o.h));

  // Bottom row: words spread edge to edge.
  size = 1;
  const B = L.bottom;
  const words = f.bottom.filter(Boolean);
  fit(ctx, words.join(''), B, B.right - B.left - 20 * (words.length - 1)); // big sizes: keep at least 20px between words
  if (words.length === 1) return text(ctx, words[0], 540 - ink(ctx, words[0]).w / 2, B.baseline);
  const widths = words.map((w) => ink(ctx, w).w);
  const gap = (B.right - B.left - widths.reduce((a, b) => a + b, 0)) / (words.length - 1);
  let x = B.left;
  words.forEach((w, i) => { text(ctx, w, x, B.baseline); x += widths[i] + gap; });
}
