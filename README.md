# Culto Stories

Tool locale per creare le stories evento (1080×1920, MP4): carichi lo sfondo animato esportato da After Effects, cambi data e locale, scegli la musica ed esporti.

## Prima installazione (una volta sola)

Serve [Node.js](https://nodejs.org) (versione 20 o superiore).

```bash
./scripts/setup.sh
```

Installa le dipendenze (ffmpeg incluso) e scarica `yt-dlp` in `bin/yt-dlp_macos/`.

## Uso quotidiano

Doppio clic su **Avvia Culto.command** → si apre il browser su http://127.0.0.1:4747.
Chiudi la finestra del Terminale per spegnerlo.

1. Trascina il video di sfondo.
2. Scegli la data (mese, giorno, apice, giorno della settimana si compilano da soli) e il locale.
3. Musica: cerca su YouTube/SoundCloud oppure carica un tuo file; scegli il punto di partenza.
4. **Esporta MP4**: il file viene scaricato, durata = durata dello sfondo.

## Ritoccare il layout

Posizioni, dimensioni e colore dei testi sono in `LAYOUT`, in cima a `public/draw.js`.

## Manutenzione

- Se YouTube smette di scaricare, aggiorna yt-dlp: cancella la cartella `bin/` e rilancia `./scripts/setup.sh`.
- Alcuni brani SoundCloud sono protetti (DRM) e non si possono scaricare.

## Nota sui diritti

I brani scaricati da YouTube/SoundCloud sono soggetti a copyright: Instagram può silenziare o bloccare la story. L'uso è sotto la tua responsabilità.

## Test

```bash
npm test
```
