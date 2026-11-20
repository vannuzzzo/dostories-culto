import { dateFields, slug } from '/lib/dates.js';
import { drawOverlay, loadFont } from './draw.js';
import { cssFilter } from '/lib/color.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const audio = $('audio'), video = $('bgVideo');
const fieldIds = ['month', 'day', 'sup', 'venue', 'weekday', 'date', 'bottom', 'label', 'names', 'from', 'till'];

let bgFile = null;
let music = null; // { file } | { audioId } | null
let tab = 'search';

const status = (msg, err = false) => { $('status').textContent = msg; $('status').classList.toggle('err', err); };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function fields() {
  const v = Object.fromEntries(fieldIds.map((id) => [id, $(id).value.trim().toUpperCase()]));
  return { ...v, bottom: v.bottom.split(/\s+/), names: v.names.split('\n').map((n) => n.trim()), lineup: $('lineup').checked };
}
const redraw = () => drawOverlay(ctx, fields());

// --- Date ---
function applyDate() {
  const [y, m, d] = $('pick').value.split('-').map(Number);
  if (!y) return;
  for (const [k, val] of Object.entries(dateFields(new Date(y, m - 1, d)))) $(k).value = val;
  redraw();
}
$('pick').valueAsDate = new Date();
$('pick').addEventListener('change', applyDate);
fieldIds.forEach((id) => $(id).addEventListener('input', redraw));
$('lineup').addEventListener('change', () => {
  $('lineupFields').hidden = !$('lineup').checked;
  $('venueField').hidden = $('lineup').checked;
  redraw();
});

// --- Background ---
function setBg(file) {
  if (!file?.type.startsWith('video/')) return status('Il file di sfondo deve essere un video', true);
  bgFile = file;
  video.src = URL.createObjectURL(file);
  video.play();
  $('bgDrop').classList.add('has');
  $('bgDrop').firstChild.textContent = `Sfondo: ${file.name} `;
  status('');
}
$('bgFile').addEventListener('change', (e) => setBg(e.target.files[0]));
// A file dropped anywhere else would make the browser open it and lose all edits.
['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => e.preventDefault()));
$('bgDrop').addEventListener('drop', (e) => { e.preventDefault(); setBg(e.dataTransfer.files[0]); });

// --- Background color (Hue/Saturation). Same math as the export, see lib/color.js ---
function applyColor() {
  $('hueLabel').textContent = `${$('hue').value}°`;
  $('satLabel').textContent = $('sat').value;
  video.style.filter = cssFilter(+$('hue').value, +$('sat').value);
}
['hue', 'sat'].forEach((id) => $(id).addEventListener('input', applyColor));
$('colorReset').addEventListener('click', () => { $('hue').value = 0; $('sat').value = 0; applyColor(); });

// --- Music ---
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  $('tab-search').hidden = tab !== 'search';
  $('tab-file').hidden = tab !== 'file';
  if (tab === 'none') setMusic(null);
}));

function setMusic(m, label = '', src = '') {
  music = m;
  audio.pause();
  $('player').hidden = !m;
  $('track').textContent = label;
  $('start').value = 0;
  $('startLabel').textContent = '0:00';
  if (src) audio.src = src; else audio.removeAttribute('src');
}
audio.addEventListener('loadedmetadata', () => { $('start').max = Math.max(0, Math.floor(audio.duration - 1)); });
$('start').addEventListener('input', () => {
  $('startLabel').textContent = fmt(+$('start').value);
  if (!audio.paused) audio.currentTime = +$('start').value;
});
$('preview').addEventListener('click', () => {
  if (!audio.paused) { audio.pause(); return; }
  audio.currentTime = +$('start').value;
  video.currentTime = 0;
  audio.play(); video.play();
});
audio.addEventListener('play', () => { $('preview').textContent = '❚❚ Ferma'; });
audio.addEventListener('pause', () => { $('preview').textContent = '▶ Anteprima con musica'; });

$('audioFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) setMusic({ file: f }, f.name, URL.createObjectURL(f));
});

async function api(url, opts) {
  // fetch only throws when the server is unreachable (Terminal window closed / tool stopped).
  const r = await fetch(url, opts).catch(() => { throw new Error('Il tool non è attivo: riaprilo con Avvia Culto.command e ricarica la pagina'); });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Errore ${r.status}`);
  return r;
}

async function search() {
  const q = $('q').value.trim();
  if (!q) return;
  status('Cerco…');
  $('results').innerHTML = '';
  try {
    const list = await (await api(`/music/search?q=${encodeURIComponent(q)}&source=${$('source').value}`)).json();
    for (const t of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = '<span></span><small></small>';
      b.firstChild.textContent = t.title;
      b.lastChild.textContent = [t.uploader, t.duration ? fmt(t.duration) : ''].filter(Boolean).join(' · ');
      b.addEventListener('click', () => download(t));
      li.append(b);
      $('results').append(li);
    }
    status(list.length ? '' : 'Nessun risultato');
  } catch (e) { status(e.message, true); }
}
$('go').addEventListener('click', search);
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

let lastDownload = 0; // only the most recent click wins
async function download(t) {
  const mine = ++lastDownload;
  status(`Scarico "${t.title}"…`);
  try {
    const { audioId } = await (await api('/music/download', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: t.url }),
    })).json();
    if (mine !== lastDownload) return;
    setMusic({ audioId }, t.title, `/music/file/${audioId}`);
    status('');
  } catch (e) { if (mine === lastDownload) status(e.message, true); }
}

// --- Export ---
$('export').addEventListener('click', async () => {
  if (!bgFile) return status('Carica prima il video di sfondo', true);
  $('export').disabled = true;
  $('export').textContent = 'Esporto…';
  status('');
  try {
    await loadFont(Object.values(fields()).flat().join('').replace(/\s/g, ''));
    redraw();
    const png = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const who = $('lineup').checked ? $('names').value : $('venue').value;
    const name = [$('pick').value, slug(who)].filter(Boolean).join('-') || 'story';
    const fd = new FormData();
    fd.append('bg', bgFile);
    fd.append('overlay', png, 'overlay.png');
    if (music?.file) fd.append('audio', music.file);
    if (music?.audioId) fd.append('audioId', music.audioId);
    fd.append('start', $('start').value);
    fd.append('hue', $('hue').value);
    fd.append('sat', $('sat').value);
    fd.append('name', name);
    const blob = await (await api('/render', { method: 'POST', body: fd })).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}.mp4` });
    a.click();
    status(`Esportato: ${name}.mp4`);
  } catch (e) { status(e.message, true); }
  $('export').disabled = false;
  $('export').textContent = 'Esporta MP4';
});

// Font must be loaded before the first draw, or the canvas uses a fallback font.
await loadFont().catch((e) => status(e.message, true));
applyDate();
