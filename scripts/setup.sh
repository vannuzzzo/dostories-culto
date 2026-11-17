#!/bin/bash
# One-time install: node deps (incl. ffmpeg) + yt-dlp.
set -e
cd "$(dirname "$0")/.."
npm install
mkdir -p bin cache
# Onedir build: the single-file yt-dlp_macos unpacks itself on every run (~15s per search).
if [ ! -x bin/yt-dlp_macos/yt-dlp_macos ]; then
  rm -rf bin/yt-dlp bin/yt-dlp_macos
  curl -L --fail -o bin/yt-dlp.zip https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos.zip
  mkdir -p bin/yt-dlp_macos && unzip -q -o bin/yt-dlp.zip -d bin/yt-dlp_macos && rm bin/yt-dlp.zip
fi
echo "Primo avvio di yt-dlp (macOS lo controlla, può volerci qualche secondo)…"
bin/yt-dlp_macos/yt-dlp_macos --version
echo "Setup completato."
