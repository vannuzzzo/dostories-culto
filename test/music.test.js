import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchArgs, parseSearch, downloadArgs, runYtDlp, audioId } from '../lib/music.js';

test('searchArgs', () => {
  assert.equal(searchArgs('belo', 'sc').at(-1), 'scsearch10:belo');
  assert.equal(searchArgs('belo', 'yt').at(-1), 'ytsearch10:belo');
});

test('parseSearch prefers webpage_url, skips junk lines', () => {
  const out = [
    JSON.stringify({ id: 'a', title: 'Dig In 97', url: 'https://api.soundcloud.com/x', webpage_url: 'https://soundcloud.com/b/dig-in-97', duration: 335.046, channel: 'Breezy' }),
    'WARNING: something',
    JSON.stringify({ id: 'b', title: 'Belo', url: 'https://www.youtube.com/watch?v=b', duration: 200 }),
  ].join('\n');
  assert.deepEqual(parseSearch(out), [
    { id: 'a', title: 'Dig In 97', url: 'https://soundcloud.com/b/dig-in-97', duration: 335.046, uploader: 'Breezy' },
    { id: 'b', title: 'Belo', url: 'https://www.youtube.com/watch?v=b', duration: 200, uploader: '' },
  ]);
});

test('downloadArgs', () => {
  const a = downloadArgs('https://x', '/c/abc');
  assert.deepEqual(a.slice(-3), ['-o', '/c/abc.%(ext)s', 'https://x']);
  assert.ok(a.includes('--no-playlist'));
});

test('audioId is a stable sha1', () => {
  assert.match(audioId('https://x'), /^[a-f0-9]{40}$/);
  assert.equal(audioId('https://x'), audioId('https://x'));
});

test('runYtDlp rejects on non-zero exit', async () => {
  await assert.rejects(runYtDlp(['x'], '/usr/bin/false'));
});

test('runYtDlp kills the process after the timeout', async () => {
  const t0 = Date.now();
  await assert.rejects(runYtDlp(['5'], '/bin/sleep', 200), /scaduto/);
  assert.ok(Date.now() - t0 < 2000);
});
