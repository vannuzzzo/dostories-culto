import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

export const YTDLP = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'yt-dlp');

export const searchArgs = (q, source) =>
  ['--flat-playlist', '--dump-json', `${source === 'sc' ? 'scsearch10' : 'ytsearch10'}:${q}`];

export function parseSearch(stdout) {
  return stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => {
    const o = JSON.parse(l);
    return { id: o.id, title: o.title, url: o.webpage_url ?? o.url, duration: o.duration, uploader: o.channel ?? o.uploader ?? '' };
  });
}

// yt-dlp needs ffmpeg to convert to mp3: point it at the bundled one.
export const downloadArgs = (url, outBase) =>
  ['-x', '--audio-format', 'mp3', '--no-playlist', '--ffmpeg-location', ffmpegPath, '-o', `${outBase}.%(ext)s`, url];

export const audioId = (url) => createHash('sha1').update(url).digest('hex');

export function runYtDlp(args, bin = YTDLP, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('tempo scaduto, riprova')); }, timeoutMs);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').at(-1) || `yt-dlp exit ${code}`));
    });
  });
}
