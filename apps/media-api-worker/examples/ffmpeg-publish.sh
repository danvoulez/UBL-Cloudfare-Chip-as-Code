#!/bin/bash
# Blueprint 13 — ffmpeg publish examples

set -e

INPUT_ID="${1:-li_01JABC...}"
RTMPS_KEY="${2:-${INPUT_ID}_KEY}"

echo "📹 Publishing to Live Input: ${INPUT_ID}"
echo ""

# RTMPS (recommended for Stage)
echo "RTMPS (Stage):"
ffmpeg -re -i input.mp4 \
  -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 128k \
  -f flv "rtmps://ingest.example/live/${RTMPS_KEY}"

# SRT (alternative, lower latency)
echo ""
echo "SRT (Stage, lower latency):"
ffmpeg -re -i input.mp4 \
  -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 128k \
  -f mpegts "srt://ingest.example:8080?streamid=${RTMPS_KEY}&mode=listener"

# WebRTC (for Party/Circle/Roulette - requires WHIP/WHEP)
# Note: This is a placeholder; actual WebRTC publish uses browser APIs or WHIP client
echo ""
echo "WebRTC (Party/Circle/Roulette):"
echo "Use browser APIs or WHIP client (see rtc-join.js)"
