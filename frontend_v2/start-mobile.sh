#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
npm install
npx expo start -c
