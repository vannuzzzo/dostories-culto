import express from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { renderArgs, runFfmpeg, probeDuration } from './lib/ffmpeg.js';
import { searchArgs, parseSearch, downloadArgs, runYtDlp, audioId } from './lib/music.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const CACHE = join(ROOT, 'cache');
const PORT = 4747;

const app = express();
const upload = multer({ dest: join(tmpdir(), 'culto-uploads') });

app.use(express.static(join(ROOT, 'public')));
app.get('/lib/dates.js', (req, res) => res.sendFile(join(ROOT, 'lib/dates.js')));

app.get('/music/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json([]);
    res.json(parseSearch(await runYtDlp(searchArgs(q, req.query.source))));
  } catch (e) {
    res.status(500).json({ error: `Ricerca fallita: ${e.message}` });
  }
});

app.post('/music/download', express.json(), async (req, res) => {
  try {
    const url = String(req.body?.url ?? '');
    if (!/^https:\/\//.test(url)) throw new Error('Link non valido');
    const id = audioId(url);
    if (!existsSync(join(CACHE, `${id}.mp3`))) await runYtDlp(downloadArgs(url, join(CACHE, id)));
    res.json({ audioId: id });
  } catch (e) {
    res.status(500).json({ error: `Download fallito: ${e.message}` });
  }
});

app.get('/music/file/:id', (req, res) => {
  if (!/^[a-f0-9]{40}$/.test(req.params.id)) return res.sendStatus(400);
  res.sendFile(join(CACHE, `${req.params.id}.mp3`));
});

app.post('/render', upload.fields([{ name: 'bg' }, { name: 'overlay' }, { name: 'audio' }]), async (req, res) => {
  const files = Object.values(req.files ?? {}).flat();
  const out = join(tmpdir(), `culto-${Date.now()}.mp4`);
  const cleanup = () => Promise.all([...files.map((f) => rm(f.path, { force: true })), rm(out, { force: true })]);
  try {
    const bg = req.files?.bg?.[0]?.path;
    const overlay = req.files?.overlay?.[0]?.path;
    if (!bg || !overlay) throw new Error('Manca il video di sfondo');
    let audio = req.files?.audio?.[0]?.path;
    if (!audio && /^[a-f0-9]{40}$/.test(req.body.audioId ?? '')) audio = join(CACHE, `${req.body.audioId}.mp3`);
    const start = Math.max(0, Number(req.body.start) || 0);
    const duration = await probeDuration(bg);
    await runFfmpeg(renderArgs({ bg, overlay, audio, start, duration, out }));
    const name = (req.body.name || 'story').replace(/[^a-z0-9-]/gi, '') || 'story';
    res.download(out, `${name}.mp4`, cleanup);
  } catch (e) {
    await cleanup();
    console.error(e.message);
    res.status(500).json({ error: e.message.split('\n').slice(-3).join(' ') });
  }
});

export { app };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(CACHE, { recursive: true });
  app.listen(PORT, '127.0.0.1', () => console.log(`Culto Stories → http://127.0.0.1:${PORT}`));
}
