#!/bin/bash
# Doppio clic per avviare Culto Stories. Chiudi questa finestra per spegnerlo.
cd "$(dirname "$0")"
URL=http://127.0.0.1:4747
if [ ! -d node_modules ] || [ ! -x bin/yt-dlp ]; then ./scripts/setup.sh || { echo "Installazione fallita"; read; exit 1; }; fi
if curl -s -o /dev/null "$URL"; then open "$URL"; exit 0; fi
node server.js &
SERVER=$!
for i in $(seq 1 20); do curl -s -o /dev/null "$URL" && break; sleep 0.5; done
open "$URL"
wait $SERVER
