@echo off
cd /d "%~dp0"
docker rm -f ecole_rdc_postgres 2>nul
docker compose -f docker-compose.yml up -d
docker ps
pause
