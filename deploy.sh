#!/usr/bin/env bash
# ==============================================================================
# Script Update & Reload Deployment (PM2 + Nginx)
# PT Wijaya Inovasi Gemilang - Content Plan Platform
# ==============================================================================

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 [1/5] Memasang dependensi terkunci..."
cd "$PROJECT_ROOT/backend"
if [ -d venv ]; then
    source venv/bin/activate
fi
pip install -r requirements.txt --quiet

echo "⚛️ [2/5] Memvalidasi backend dan membangun frontend..."
python3 manage.py check --deploy --settings=config.settings.production
cd "$PROJECT_ROOT/frontend"
npm ci --prefer-offline
npm run lint
npx tsc --noEmit
npm run build

echo "🗄️ [3/5] Menjalankan migrasi dan mengumpulkan static files..."
cd "$PROJECT_ROOT/backend"
python3 manage.py migrate --noinput
python3 manage.py collectstatic --noinput

echo "📁 [4/5] Menyiapkan direktori log PM2..."
mkdir -p "$PROJECT_ROOT/logs/pm2"

echo "🚀 [5/5] Memuat ulang semua proses PM2..."
cd "$PROJECT_ROOT"
pm2 reload ecosystem.config.js --update-env

echo "🎉 Deployment Selesai! Layanan PT Wijaya Inovasi Gemilang berjalan dengan lancar."
