#!/bin/bash
# One-time install: node deps (incl. ffmpeg) + yt-dlp standalone binary.
set -e
cd "$(dirname "$0")/.."
npm install
mkdir -p bin cache
if [ ! -x bin/yt-dlp ]; then
  curl -L --fail -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
  chmod +x bin/yt-dlp
fi
echo "Setup completato."
