import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorMatrix, cssFilter, mixerFilter } from '../lib/color.js';

const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-3, `${i}: ${v} vs ${b[i]}`));

test('neutral = identity, no ffmpeg filter', () => {
  close(colorMatrix(0, 0), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(mixerFilter(0, 0), '');
  assert.equal(cssFilter(0, 0), 'none');
});

test('saturation -100 = grayscale with CSS luminance weights', () => {
  const m = colorMatrix(0, -100);
  for (const row of [0, 3, 6]) close(m.slice(row, row + 3), [0.213, 0.715, 0.072]);
});

test('hue 180 matches CSS hue-rotate(180deg) spec matrix', () => {
  close(colorMatrix(180, 0), [-0.574, 1.43, 0.144, 0.426, 0.43, 0.144, 0.426, 1.43, -0.856]);
});

test('css filter string mirrors the matrix order (saturate, then hue-rotate)', () => {
  assert.equal(cssFilter(30, -50), 'saturate(0.5) hue-rotate(30deg)');
});

test('mixerFilter: saturate then hue-rotate as separate steps (browser clamps between)', () => {
  const m = mixerFilter(30, -50);
  assert.equal(m.match(/colorchannelmixer=/g).length, 2);
  assert.match(m, /^format=gbrp,colorchannelmixer=rr=0\.6065:/); // saturate(0.5): 0.213+0.787*0.5
  assert.equal(mixerFilter(30, 0).match(/colorchannelmixer=/g).length, 1);
});
