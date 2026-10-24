#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите его с https://nodejs.org (кнопка LTS) и запустите этот файл ещё раз."
  read -r -p "Нажмите Enter, чтобы закрыть окно"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Установка зависимостей, это займёт несколько минут..."
  npm install || { read -r -p "Нажмите Enter, чтобы закрыть окно"; exit 1; }
fi
npm run demo
