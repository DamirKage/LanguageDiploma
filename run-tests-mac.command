#!/bin/bash
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm test && npm run coverage && npm audit
read -p "Запустить тесты в браузере? (y/n) " a
if [ "$a" = "y" ]; then npx playwright install chromium && npm run e2e; fi
read -p "Готово. Нажмите Enter."
