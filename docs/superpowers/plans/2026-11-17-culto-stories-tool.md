# Culto Stories Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local web tool: drop an animated background video, edit event texts, pick a song (YouTube/SoundCloud search or own MP3), export a 1080×1920 MP4 in seconds.

**Architecture:** Node server (express) serves a single page and runs bundled ffmpeg/yt-dlp. The browser draws the texts on a 1080×1920 canvas — same function for live preview and for the transparent PNG sent to the server — so preview = output. Server composites `bg video + overlay PNG + audio` with ffmpeg.

**Tech Stack:** Node 26 (ESM), express, multer, ffmpeg-static, yt-dlp standalone macOS binary, plain HTML/JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-culto-stories-tool-design.md`

## Global Constraints

- Output: MP4 H.264, 1080×1920, 30fps, AAC audio, `yuv420p` (Instagram-compatible).
- Duration = background video duration. Audio: hard cut, **no fade**.
- Font: Cossette Titre (Google Fonts), used both in preview and export.
- Ordinal suffix follows the day: 1ST 2ND 3RD, 4–20 TH, 21ST 22ND 23RD, 24–30 TH, 31ST.
- Default bottom row: `NOT AN ORDINARY CULTO` (4 words, editable).
- Server listens on `http://localhost:4321`, localhost only.
- No terminal for daily use: `Avvia Culto.command` double-click starts server + opens browser.
- Git: private repo; `.gitignore` excludes `node_modules/`, `bin/`, `cache/`, `*.mp4`, `*.mov`, `*.mp3`, `*.m4a`.

## Review Focus

1. Days 11, 12, 13 → `TH` (not ST/ND/RD). Test in Task 1.
2. Song shorter than the video → video keeps full length, silence after the song (`apad` + `-shortest`). Test in Task 2.
3. Background not exactly 1080×1920/30fps (e.g. a 4K or 25fps export from AE) → scaled and forced to 1080×1920@30. Test in Task 2.
4. Export clicked before the webfont is loaded → texts in fallback font. `await document.fonts.load(...)` before every draw; manual check in Task 4.
5. yt-dlp fails (no internet, unavailable video) → error message in the page, server keeps running. Test in Task 3 (`runYtDlp` rejects on non-zero exit, route returns 500 JSON).

---

## File Structure

```
package.json            deps + "test": "node --test"
server.js               express app: static, /render, /music/*
lib/dates.js            ordinal(), dateFields(), slug()   (also served to browser)
lib/ffmpeg.js           renderArgs(), runFfmpeg()
lib/music.js            runYtDlp(), searchArgs(), parseSearch(), downloadArgs()
public/index.html       form + preview + music panel
public/draw.js          LAYOUT constants + drawOverlay(ctx, fields)
public/app.js           UI wiring, export
scripts/setup.sh        npm install + download yt-dlp into bin/
Avvia Culto.command     launcher
test/*.test.js
README.md
```

`server.js` serves `lib/dates.js` at `/lib/dates.js` so the browser imports the tested module directly.

---

### Task 1: Project scaffold + date helpers

**Files:** Create `package.json`, `.gitignore`, `lib/dates.js`, `test/dates.test.js`

**Interfaces — Produces:**
- `ordinal(day: number) -> "ST"|"ND"|"RD"|"TH"`
- `dateFields(d: Date) -> { month: "NOV.", day: "19", sup: "TH", weekday: "THURSDAY", date: "19.11.2026" }` (English uppercase month abbr with dot: JAN. FEB. MAR. APR. MAY JUN. JUL. AUG. SEP. OCT. NOV. DEC. — MAY without dot)
- `slug(s: string) -> string` (lowercase, accents stripped, non-alnum → `-`, trimmed)

- [ ] **Step 1:** `git init`, `npm init -y`, set `"type": "module"`, `"scripts": {"test": "node --test", "start": "node server.js"}`; write `.gitignore` per Global Constraints.
- [ ] **Step 2: Failing tests**

```js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { ordinal, dateFields, slug } from '../lib/dates.js';
test('ordinal', () => {
  const exp = {1:'ST',2:'ND',3:'RD',4:'TH',11:'TH',12:'TH',13:'TH',21:'ST',22:'ND',23:'RD',30:'TH',31:'ST'};
  for (const [d, s] of Object.entries(exp)) assert.equal(ordinal(+d), s);
});
test('dateFields', () => {
  assert.deepEqual(dateFields(new Date(2026, 10, 19)),
    { month: 'NOV.', day: '19', sup: 'TH', weekday: 'THURSDAY', date: '19.11.2026' });
  assert.equal(dateFields(new Date(2026, 4, 1)).month, 'MAY');
  assert.equal(dateFields(new Date(2026, 4, 1)).date, '01.05.2026');
});
test('slug', () => assert.equal(slug('Giovedì MAISON 3!'), 'giovedi-maison-3'));
```

- [ ] **Step 3:** `npm test` → FAIL (module missing).
- [ ] **Step 4:** Implement `lib/dates.js` (pure, no Node imports — runs in browser too).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: scaffold + date helpers`.

### Task 2: ffmpeg render + `/render` endpoint

**Files:** Create `lib/ffmpeg.js`, `server.js`, `test/ffmpeg.test.js`

**Interfaces:**
- Produces `renderArgs({ bg, overlay, audio?, start=0, out }) -> string[]`
- Produces `runFfmpeg(args: string[]) -> Promise<string /*stderr*/>`, rejects with stderr tail on non-zero exit. Binary path from `ffmpeg-static`.
- Produces `POST /render` multipart: fields `bg` (video file), `overlay` (PNG), optional `audio` (file) or `audioId` (string, from Task 3 cache), `start` (seconds), `name` (filename). Responds `video/mp4` attachment `<name>.mp4`; 500 `{error}` on failure. Temp files in `os.tmpdir()`, deleted after response.

Filter graph (decided, not derivable):
```
[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[b];
[b][1:v]overlay=0:0,format=yuv420p[v]
```
Audio when present: input `-ss <start> -i <audio>`, `-map 2:a -af apad -shortest`; output `-c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k -movflags +faststart`. Without audio: `-an`.

- [ ] **Step 1:** `npm i express multer ffmpeg-static`.
- [ ] **Step 2: Failing test** — generate fixtures with `runFfmpeg` in a tmp dir: `bg.mp4` = `lavfi testsrc=size=720x1280:rate=25` 3s; `overlay.png` = `lavfi color=c=white@0.0:s=1080x1920,format=rgba` 1 frame; `song.mp3` = `lavfi sine` 1s. Then:
  - `test('scales to 1080x1920@30 and keeps bg length with short song')`: render with audio → parse `ffmpeg -i out.mp4` stderr: contains `1080x1920`, `30 fps`, `Audio: aac`, `Duration: 00:00:03`.
  - `test('no audio')`: render without audio → stderr has no `Audio:`.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implement `lib/ffmpeg.js`, then `server.js` (express static `public/`, `/lib/dates.js`, multer to tmp, `/render`), bind `127.0.0.1:4321`.
- [ ] **Step 5:** `npm test` → PASS. Manual: `curl -F bg=@bg.mp4 -F overlay=@overlay.png -F name=x localhost:4321/render -o x.mp4` plays.
- [ ] **Step 6:** Commit `feat: ffmpeg render endpoint`.

### Task 3: Music — yt-dlp search/download + upload

**Files:** Create `lib/music.js`, `scripts/setup.sh`, `test/music.test.js`; Modify `server.js`

**Interfaces:**
- `YTDLP = <repo>/bin/yt-dlp`; `scripts/setup.sh` runs `npm install` and downloads `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos` to `bin/yt-dlp`, `chmod +x`.
- `searchArgs(q: string, source: "yt"|"sc") -> string[]` → `["--flat-playlist","--dump-json", source==="yt" ? "ytsearch10:"+q : "scsearch10:"+q]`
- `parseSearch(stdout: string) -> {id,title,url,duration}[]` (one JSON per line; `url` = `webpage_url ?? url`)
- `downloadArgs(url, outBase) -> string[]` → `["-x","--audio-format","mp3","--no-playlist","-o", outBase+".%(ext)s", url]`
- `runYtDlp(args) -> Promise<string>` rejects on non-zero exit with stderr tail.
- Routes: `GET /music/search?q=&source=` → JSON list; `POST /music/download {url}` → `{audioId}` (file `cache/<sha1(url)>.mp3`, reused if present); `GET /music/file/:audioId` streams it (validate `/^[a-f0-9]{40}$/`). `/render` with `audioId` reads `cache/<audioId>.mp3`.

- [ ] **Step 1: Failing tests**: `parseSearch` on two fixture lines returns 2 items with exact titles/urls; `searchArgs('belo','sc')[2] === 'scsearch10:belo'`; `runYtDlp` with a bogus binary path / bad args rejects (point `YTDLP` override param: `runYtDlp(args, bin = YTDLP)`, test with `bin='/usr/bin/false'`).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Run `scripts/setup.sh`; manual: `curl 'localhost:4321/music/search?q=dig%20in%2097&source=yt'` returns results; download one, `GET /music/file/<id>` plays.
- [ ] **Step 6:** Commit `feat: music search/download`.

### Task 4: Page — form, live preview, music panel, export

**Files:** Create `public/index.html`, `public/draw.js`, `public/app.js`

**Interfaces:**
- `drawOverlay(ctx, f)` where `f = { month, day, sup, venue, weekday, date, bottom: string[4] }`; clears canvas, draws texts in `#EDEDED`, font `"Cossette Titre"`.
- `LAYOUT` (1080×1920 px, measured from the AE screenshot — tune by eye once):
  - Line 1 `month + " " + day`: right-aligned so `sup` ends at x=896, baseline y=413, size 205px; `sup` size 105px, top aligned to cap top of line 1.
  - Line 2 `venue`: right-aligned x=896, baseline y=574, size 205px.
  - `weekday`: left x=193, baseline y=626, size 48px. `date`: right x=896, same baseline/size.
  - `bottom` 4 words: baseline y=1633, size 47px, first word left at x=193, last word right at x=896, middle two evenly spaced (space-between).
  - If line 1/2 is wider than 703px (193→896), shrink that line's font to fit.

Page behaviour:
- Background: file input / drag-drop → `<video muted loop autoplay>` behind a 1080×1920 `<canvas>` (CSS-scaled, same aspect).
- Fields: date picker (fills month/day/sup/weekday/date via `dateFields`, each still editable), venue, bottom (default `NOT AN ORDINARY CULTO`). Redraw on every input, after `await document.fonts.load('205px "Cossette Titre"')`.
- Music: tabs "Cerca" (query + YouTube/SoundCloud toggle → results list → click = download → `audioId`) and "Mio file" (file input). `<audio>` preview; slider "Inizio" 0…(audio.duration − 1) s, step 0.5; playing preview starts at slider value. "Nessuna musica" allowed.
- Export: canvas → `toBlob('image/png')` → FormData(bg, overlay, audio|audioId, start, name=`YYYY-MM-DD-<slug(venue)>`) → `POST /render` → download blob. Button disabled + "Esporto…" while running; show server `{error}` on failure.
- Google Fonts `<link>` for Cossette Titre in `index.html`.

- [ ] **Step 1:** Build page. **Step 2:** `npm test` still PASS.
- [ ] **Step 3: Manual check** (with the real AE background export): preview matches screenshot layout; change date to 1, 2, 3, 11, 22 → suffix updates; export → MP4 plays in QuickTime, texts in Cossette Titre (not fallback), 1080×1920, song starts at chosen point, no fade, length = background.
- [ ] **Step 4:** Commit `feat: editor page`.

### Task 5: Launcher, README, GitHub

**Files:** Create `Avvia Culto.command`, `README.md`

- [ ] **Step 1:** `Avvia Culto.command`: `cd "$(dirname "$0")"`; if `node_modules` or `bin/yt-dlp` missing run `scripts/setup.sh`; start `node server.js &`; wait until port answers (`curl -s localhost:4321 >/dev/null` loop, max 10s); `open http://localhost:4321`; `wait`. If the port is already in use, just `open` the URL. `chmod +x`.
- [ ] **Step 2:** Manual: double-click in Finder → browser opens on the tool; closing the Terminal window stops the server.
- [ ] **Step 3:** README (Italian, short): first install (one-time), daily use, how to update yt-dlp (`bin/yt-dlp -U`), copyright note on downloaded songs.
- [ ] **Step 4:** Commit `feat: launcher + readme`.
- [ ] **Step 5:** User creates an empty **private** GitHub repo and gives the URL (no `gh`/brew on this Mac). `git remote add origin <url>`, `git branch -M main`, `git push -u origin main` (user authenticates in the macOS credential prompt / token).
