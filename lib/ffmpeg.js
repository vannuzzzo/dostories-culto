import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { mixerFilter } from './color.js';

const filter = (hue, sat) =>
  `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,${mixerFilter(hue, sat)}fps=30[b];` +
  '[b][1:v]overlay=0:0,format=yuv420p[v]';

// duration = background length; explicit -t because apad + -shortest hangs/drops audio in ffmpeg 6.
export function renderArgs({ bg, overlay, audio, start = 0, duration, hue = 0, sat = 0, out }) {
  const args = ['-y', '-i', bg, '-i', overlay];
  if (audio) args.push('-ss', String(start), '-i', audio);
  args.push('-filter_complex', filter(hue, sat), '-map', '[v]');
  if (audio) args.push('-map', '2:a', '-af', 'apad', '-c:a', 'aac', '-b:a', '192k');
  else args.push('-an');
  args.push('-t', String(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', out);
  return args;
}

export function runFfmpeg(args, bin = ffmpegPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(err.slice(-2000)))));
  });
}

// ffmpeg-static ships no ffprobe: read "Duration: HH:MM:SS.xx" from `ffmpeg -i` (which exits 1).
export async function probeDuration(file) {
  const info = await runFfmpeg(['-i', file]).catch((e) => e.message);
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error('Video di sfondo non leggibile');
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
