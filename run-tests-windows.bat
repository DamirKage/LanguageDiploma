@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите его с https://nodejs.org ^(кнопка LTS^).
  pause
  exit /b 1
)
if not exist node_modules (
  echo Установка зависимостей...
  call npm install
)
echo.
echo ===== 1. Модульные и интеграционные тесты (около минуты) =====
call npm test
echo.
echo ===== 2. Покрытие кода тестами =====
call npm run coverage
echo.
echo ===== 3. Проверка библиотек на уязвимости =====
call npm audit
echo.
choice /m "Запустить тесты в браузере (первый раз скачается браузер, около 150 МБ)"
if errorlevel 2 goto end
call npx playwright install chromium
call npm run e2e
:end
echo.
echo Готово. Подробный отчёт о тестах: docs\testing.md
pause
