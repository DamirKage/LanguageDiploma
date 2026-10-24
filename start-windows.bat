@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите его с https://nodejs.org ^(кнопка LTS^) и запустите этот файл ещё раз.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Установка зависимостей, это займёт несколько минут...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run demo
pause
