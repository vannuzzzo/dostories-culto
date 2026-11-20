import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLogos, recolor, LAYOUT } from '../public/draw.js';

const row = { ...LAYOUT.logos, left: 195, right: 894, height: 120, gap: 40, bottom: 1590 };
const r = (rects) => rects.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10])));

test('no logos', () => assert.deepEqual(layoutLogos([], row), []));

test('one logo: full height, centered between margins', () => {
  assert.deepEqual(r(layoutLogos([{ w: 200, h: 100 }], row)), [{ x: 424.5, y: 1470, w: 240, h: 120 }]);
});

test('one very wide logo shrinks to the margins', () => {
  const [o] = layoutLogos([{ w: 2000, h: 100 }], row);
  assert.equal(o.x, 195);
  assert.equal(Math.round(o.x + o.w), 894);
  assert.ok(o.h < 120);
});

test('two logos that do not fit: whole row shrinks, spread edge to edge, vertically centered', () => {
  const rects = layoutLogos([{ w: 400, h: 100 }, { w: 400, h: 100 }], row);
  const h = 120 * ((699 - 40) / 960);
  assert.ok(Math.abs(rects[0].h - h) < 0.01);
  assert.equal(rects[0].x, 195);
  assert.ok(Math.abs(rects[1].x + rects[1].w - 894) < 0.01);
  assert.ok(rects[1].x - (rects[0].x + rects[0].w) >= 40);
  assert.ok(Math.abs(rects[0].y + h / 2 - (1590 - 60)) < 0.01); // centered on the full-size row
});

test('three small logos keep full height and stay inside margins', () => {
  const rects = layoutLogos([{ w: 100, h: 100 }, { w: 50, h: 100 }, { w: 100, h: 100 }], row);
  assert.ok(rects.every((o) => o.h === 120 && o.x >= 195 && o.x + o.w <= 894.001));
});

test('recolor: bw is grayscale (luma), keeps alpha', () => {
  const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128, 200, 30, 30, 0]);
  recolor(px, 'bw');
  // red (200,30,30) → luma ~66 gray; alpha untouched
  assert.deepEqual([...px], [255, 255, 255, 255, 0, 0, 0, 128, 66, 66, 66, 0]);
});

test('recolor: white / black make a solid silhouette', () => {
  const a = new Uint8ClampedArray([10, 200, 90, 77]);
  recolor(a, 'white');
  assert.deepEqual([...a], [255, 255, 255, 77]);
  recolor(a, 'black');
  assert.deepEqual([...a], [0, 0, 0, 77]);
});

test('recolor: #DEDEDE variants use the text color instead of pure white', () => {
  const a = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  recolor(a, 'bwText');
  assert.deepEqual([...a], [222, 222, 222, 255, 0, 0, 0, 255]);
  recolor(a, 'text');
  assert.deepEqual([...a], [222, 222, 222, 255, 222, 222, 222, 255]);
});
