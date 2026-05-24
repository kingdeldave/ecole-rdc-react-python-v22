@echo off
cd /d "%~dp0frontend"
npm config set registry https://registry.npmjs.org/
if not exist node_modules npm install
if not exist .env copy .env.example .env
npm run dev -- --host 0.0.0.0
pause
