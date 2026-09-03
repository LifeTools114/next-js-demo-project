@echo off
rem  Hanoi direct-buy server starter (double-click me)
rem  Runs scripts\start-server.ps1 : git pull -> npm install -> restart dev server
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-server.ps1"
if errorlevel 1 pause
