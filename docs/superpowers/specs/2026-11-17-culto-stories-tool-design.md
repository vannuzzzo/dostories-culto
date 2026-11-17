# Culto Stories Tool — design

## Perché
Ogni story evento (1080×1920, 15s) oggi richiede di modificare i testi in After Effects e aspettare un render lento. Obiettivo: cambiare le info e avere l'MP4 in pochi secondi, con layout e font identici.

## Obiettivi
- Carico lo sfondo animato (video già esportato da AE), compilo i testi, scelgo la musica, esporto MP4.
- Anteprima identica al risultato finale.
- Avvio con doppio clic, nessun terminale nell'uso quotidiano.
- Codice su GitHub, riusabile per altri tool in futuro.

## Non-obiettivi
- Animare i testi (restano fissi sopra lo sfondo).
- Creare/animare lo sfondo (resta in After Effects).
- Più layout/template (uno solo, quello attuale).

## Anti-obiettivi
- Testi che nell'MP4 non coincidono con l'anteprima.
- Export lento quanto After Effects.

## Approcci considerati
- **A. Pagina web locale + ffmpeg (scelto)**: export veloce, anteprima = risultato.
- B. Tutto nel browser (ffmpeg.wasm): niente installazione ma export 1–3 min.
- C. Template After Effects + script: render lento come oggi, musica scomoda.

## Decisioni prese insieme
- Approccio A.
- Font: Cossette Titre (Google Fonts).
- ffmpeg incluso nel tool (`ffmpeg-static`), mai da aprire a mano.
- Avvio: `Avvia Culto.command` (doppio clic → server parte, browser si apre).
- Musica: (1) ricerca + download da YouTube/SoundCloud con `yt-dlp`, (3) trascinamento MP3 proprio. Rischio copyright/termini d'uso accettato dall'utente.
- Repo su GitHub dell'utente.

## Proposte mie (correggibili)
- **Campi**: scegli la data da un calendario e il tool compila da solo "NOV. 19TH", "THURSDAY", "19.11.2026"; tutti modificabili a mano. L'apice segue il giorno: 1ST, 2ND, 3RD, 4TH… 11TH, 12TH, 13TH, 21ST, 22ND, 23RD, 31ST. Campi liberi: nome locale ("MAISON 3"), riga in basso (default "NOT AN ORDINARY CULTO", 4 parole distribuite, modificabile ma di solito invariata).
- **Posizioni testi**: ricavate dallo screenshot AE; se serve, si ritoccano una volta nel codice.
- **Come funziona l'export**: i testi vengono disegnati nel browser su un PNG trasparente 1080×1920 (stesso codice dell'anteprima); il server Node passa a ffmpeg sfondo + PNG + audio → MP4 H.264, 1080×1920, 30fps.
- **Musica**: cursore per scegliere il punto di partenza; durata = durata dello sfondo; nessuna dissolvenza (taglio netto).
- **Nome file**: es. `2026-11-19-maison-3.mp4`, scaricato dal browser.
- **Repo privato**; video, musica e file generati esclusi da git (`.gitignore`).
- `yt-dlp` scaricato automaticamente come binario alla prima installazione.

## Lasciato a chi costruisce
- Struttura dei file, nomi interni, stile dell'interfaccia (scuro, sobrio).
