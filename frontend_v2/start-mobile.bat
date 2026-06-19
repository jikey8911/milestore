@echo off
setlocal
cd /d "%~dp0"
npm install
npx expo start -c
