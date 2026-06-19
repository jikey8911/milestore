#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
docker compose up --build -d
docker compose ps
