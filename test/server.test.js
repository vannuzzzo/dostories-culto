import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { app } from '../server.js';

const srv = app.listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const port = srv.address().port;
after(() => srv.close());

const get = (path, headers = {}) => new Promise((resolve, reject) => {
  request({ host: '127.0.0.1', port, path, headers }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject).end();
});

test('page loads from 127.0.0.1', async () => assert.equal(await get('/'), 200));
test('rejects requests from other websites', async () => assert.equal(await get('/music/search?q=', { Origin: 'https://evil.example' }), 403));
test('allows own origin', async () => assert.equal(await get('/music/search?q=', { Origin: `http://127.0.0.1:${port}` }), 200));
test('rejects foreign Host (DNS rebinding)', async () => assert.equal(await get('/', { Host: `evil.example:${port}` }), 403));

test('font is served locally, not from Google', () => {
  assert.ok(existsSync(new URL('../public/fonts/CossetteTitre.ttf', import.meta.url)));
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis/);
  assert.match(html, /fonts\/CossetteTitre\.ttf/);
});
