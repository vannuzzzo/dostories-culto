import { dateFields, slug } from '/lib/dates.js';
import { drawOverlay, loadFont, recolor } from './draw.js';
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
  return {
    ...v, bottom: v.bottom.split(/\s+/), names: v.names.split('\n').map((n) => n.trim()), lineup: $('lineup').checked, showVenue: $('showVenue').checked,
    calendar: $('calendar').checked,
    calTitle: [$('calTitle1').value, $('calTitle2').value].map((s) => s.trim().toUpperCase()),
    calDays: [...document.querySelectorAll('.calDay')].map((r) => ({ day: r.children[0].value.trim().toUpperCase(), event: r.children[1].value.trim().toUpperCase() })),
    calHours: $('calHours').value.trim().toUpperCase(),
  };
}

// --- Weekly calendar: 7 rows (Mon–Sun) of day label + event ---
$('calDays').replaceChildren(...Array.from({ length: 7 }, (_, i) => {
  const r = Object.assign(document.createElement('div'), { className: 'calDay' });
  const day = Object.assign(document.createElement('input'), { ariaLabel: `Giorno ${i + 1}` });
  const ev = Object.assign(document.createElement('input'), { placeholder: 'Evento', ariaLabel: `Evento ${i + 1}` });
  r.append(day, ev);
  return r;
}));
// Fills the day labels (and title month) from the week of the picked date; events are left untouched.
function fillWeek(d) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  document.querySelectorAll('.calDay').forEach((r, i) => {
    const f = dateFields(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    r.children[0].value = `${f.weekday} ${f.day}${f.sup}`;
  });
  $('calTitle1').value = d.toLocaleString('en', { month: 'long' }).toUpperCase();
}
$('calFields').addEventListener('input', () => redraw());
$('calendar').addEventListener('change', () => {
  $('calFields').hidden = !$('calendar').checked;
  $('normalFields').hidden = $('calendar').checked;
  redraw();
});
let logos = []; // [{ name, img, cache: { mode: canvas } }] in display order
function tinted(img, mode) {
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height);
  recolor(data.data, mode);
  cx.putImageData(data, 0, 0);
  return c;
}
const logoSources = () => {
  const mode = $('logoColor').value;
  return logos.map((l) => (mode === 'orig' ? l.img : (l.cache[mode] ??= tinted(l.img, mode))));
};
const redraw = () => drawOverlay(ctx, { ...fields(), logos: logoSources(), logoHeight: +$('logoSize').value, topSize: $('topSize').value / 100, djSize: $('djSize').value / 100 });

// --- Date ---
function applyDate() {
  const [y, m, d] = $('pick').value.split('-').map(Number);
  if (!y) return;
  for (const [k, val] of Object.entries(dateFields(new Date(y, m - 1, d)))) $(k).value = val;
  fillWeek(new Date(y, m - 1, d));
  redraw();
}
$('pick').valueAsDate = new Date();
$('pick').addEventListener('change', applyDate);
fieldIds.forEach((id) => $(id).addEventListener('input', redraw));
$('lineup').addEventListener('change', () => {
  $('lineupFields').hidden = !$('lineup').checked;
  redraw();
});
$('showVenue').addEventListener('change', () => { $('venueField').hidden = !$('showVenue').checked; redraw(); });

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

// --- Partner logos ---
async function addLogos(files) {
  for (const file of files) {
    if (file.type !== 'image/png') { status(`${file.name}: serve un PNG`, true); continue; }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    try { await img.decode(); } catch { status(`${file.name}: immagine non leggibile`, true); continue; }
    logos.push({ name: file.name, img, cache: {} });
  }
  renderLogos();
}
function renderLogos() {
  $('logoList').replaceChildren(...logos.map((l, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = l.name;
    const rm = Object.assign(document.createElement('button'), { textContent: '✕', title: 'Rimuovi' });
    rm.setAttribute('aria-label', `Rimuovi ${l.name}`);
    rm.addEventListener('click', () => { URL.revokeObjectURL(l.img.src); logos.splice(i, 1); renderLogos(); });
    li.append(name, rm);
    return li;
  }));
  redraw();
}
$('logoSize').addEventListener('input', () => { $('logoSizeLabel').textContent = `${$('logoSize').value} px`; redraw(); });
$('logoColor').addEventListener('change', redraw);
['topSize', 'djSize'].forEach((id) => $(id).addEventListener('input', () => { $(`${id}Label`).textContent = `${$(id).value}%`; redraw(); }));
$('logoFile').addEventListener('change', (e) => { addLogos([...e.target.files]); e.target.value = ''; });
$('logoDrop').addEventListener('drop', (e) => { e.preventDefault(); addLogos([...e.dataTransfer.files]); });

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
    await loadFont(JSON.stringify(fields()));
    redraw();
    const png = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const who = $('calendar').checked ? 'calendario' : $('showVenue').checked ? $('venue').value : $('lineup').checked ? $('names').value : '';
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
    remember(name);
    status(`Esportato: ${name}.mp4`);
  } catch (e) { status(e.message, true); }
  $('export').disabled = false;
  $('export').textContent = 'Esporta MP4';
});

// --- Memory: the last state is autosaved and reopened; every export is kept in the dropdown.
// shortcut: only texts, sliders and colors are saved — background video, logos and music are files and must be reloaded; localStorage is per browser.
const saved = ['pick', 'calendar', 'calTitle1', 'calTitle2', 'calHours', 'topSize', 'month', 'day', 'sup', 'showVenue', 'venue', 'lineup', 'djSize', 'label', 'names', 'from', 'till', 'weekday', 'date', 'bottom', 'logoSize', 'logoColor', 'hue', 'sat'];
const calRows = () => [...document.querySelectorAll('.calDay')];
const snap = () => ({ ...Object.fromEntries(saved.map((id) => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value])), cal: calRows().map((r) => [r.children[0].value, r.children[1].value]) });
const store = (k, v) => { try { localStorage.setItem(`culto:${k}`, JSON.stringify(v)); } catch { /* storage blocked: memory just doesn't persist */ } };
const load = (k) => { try { return JSON.parse(localStorage.getItem(`culto:${k}`)); } catch { return null; } };
function restore(s) {
  if (!s) return;
  const ids = saved.filter((id) => id in s);
  ids.forEach((id) => { if ($(id).type === 'checkbox') $(id).checked = s[id]; else $(id).value = s[id]; });
  calRows().forEach((r, i) => { [r.children[0].value, r.children[1].value] = s.cal?.[i] ?? ['', '']; });
  // Fire the normal listeners so toggles, labels and the video filter follow; 'pick' is skipped because its handler would overwrite the texts.
  ids.filter((id) => id !== 'pick').forEach((id) => $(id).dispatchEvent(new Event($(id).type === 'checkbox' || $(id).tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })));
  redraw();
}
document.querySelector('aside').addEventListener('input', () => store('last', snap()));
document.querySelector('aside').addEventListener('change', () => store('last', snap()));
const exportsList = () => load('exports') ?? [];
function renderHistory() {
  $('history').replaceChildren($('history').options[0], ...exportsList().map((e, i) => Object.assign(document.createElement('option'), { value: i, textContent: e.name })));
}
function remember(name) {
  store('exports', [{ name, s: snap() }, ...exportsList().filter((e) => e.name !== name)].slice(0, 30));
  renderHistory();
}
$('history').addEventListener('change', () => {
  restore(exportsList()[$('history').value]?.s);
  $('history').value = '';
  store('last', snap());
});

// Font must be loaded before the first draw, or the canvas uses a fallback font.
await loadFont().catch((e) => status(e.message, true));
applyDate();
restore(load('last'));
renderHistory();
