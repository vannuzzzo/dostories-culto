import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderArgs, runFfmpeg, probeDuration } from '../lib/ffmpeg.js';

const dir = mkdtempSync(join(tmpdir(), 'culto-test-'));
const f = (n) => join(dir, n);
// ffmpeg exits 1 with "-i" only; we just want the stream info in stderr.
const probe = (file) => runFfmpeg(['-i', file]).catch((e) => e.message);

before(async () => {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=25', '-t', '3', '-pix_fmt', 'yuv420p', f('bg.mp4')]);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=white@0.0:s=1080x1920,format=rgba', '-frames:v', '1', f('overlay.png')]);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'sine', '-t', '1', f('song.mp3')]);
});

test('scales to 1080x1920@30 and keeps bg length with short song', async () => {
  await runFfmpeg(renderArgs({ bg: f('bg.mp4'), overlay: f('overlay.png'), audio: f('song.mp3'), start: 0.2, duration: await probeDuration(f('bg.mp4')), out: f('a.mp4') }));
  const info = await probe(f('a.mp4'));
  assert.match(info, /1080x1920/);
  assert.match(info, /30 fps/);
  assert.match(info, /Audio: aac/);
  assert.match(info, /Duration: 00:00:03/);
});

test('no audio', async () => {
  await runFfmpeg(renderArgs({ bg: f('bg.mp4'), overlay: f('overlay.png'), duration: 3, out: f('b.mp4') }));
  const info = await probe(f('b.mp4'));
  assert.match(info, /1080x1920/);
  assert.doesNotMatch(info, /Audio:/);
});

test('probeDuration', async () => assert.equal(await probeDuration(f('bg.mp4')), 3));

test('near-9:16 input comes out with square pixels', async () => {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=size=1000x1778:rate=30', '-t', '1', '-pix_fmt', 'yuv420p', f('odd.mp4')]);
  await runFfmpeg(renderArgs({ bg: f('odd.mp4'), overlay: f('overlay.png'), duration: 1, out: f('c.mp4') }));
  assert.match(await probe(f('c.mp4')), /1080x1920 \[SAR 1:1 DAR 9:16\]/);
});

test('saturation -100 turns the background gray', async () => {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1080x1920:r=30', '-t', '1', '-pix_fmt', 'yuv420p', f('red.mp4')]);
  await runFfmpeg(renderArgs({ bg: f('red.mp4'), overlay: f('overlay.png'), duration: 1, sat: -100, out: f('gray.mp4') }));
  await runFfmpeg(['-y', '-i', f('gray.mp4'), '-frames:v', '1', '-vf', 'crop=2:2:540:960', '-f', 'rawvideo', '-pix_fmt', 'rgb24', f('px.rgb')]);
  const [r, g, b] = readFileSync(f('px.rgb'));
  assert.ok(Math.abs(r - g) < 6 && Math.abs(g - b) < 6, `pixel ${r},${g},${b} is not gray`);
});
