import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
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
