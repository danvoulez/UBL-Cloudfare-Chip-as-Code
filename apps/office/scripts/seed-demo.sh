#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cd workers/office-api-worker
echo "Seeding demo rows..."
wrangler d1 execute office-db --command "INSERT INTO files (id, tenant, path, kind, hash, canonical) VALUES ('f1','voulezvous','spec/part1.md','spec','abc',1);"
wrangler d1 execute office-db --command "INSERT INTO anchors (id, file_id, type, location, preview, context) VALUES ('a1','f1','text','p1#t1-10','Intro','context snippet');"
echo "Done."