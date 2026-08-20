#!/usr/bin/env bash
# ==============================================================================
# Script Update & Reload Deployment (PM2 + Nginx)
# PT Wijaya Inovasi Gemilang - Content Plan Platform
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 [1/4] Menjalankan pembaruan dependensi & migrasi Django..."
cd "$PROJECT_ROOT/backend"
if [ -d venv ]; then
    source venv/bin/activate
fi
pip install -r requirements.txt --quiet
python3 manage.py migrate --noinput
python3 manage.py collectstatic --noinput

echo "⚛️ [2/4] Membangun ulang Next.js Frontend..."
cd "$PROJECT_ROOT/frontend"
npm install --prefer-offline
npm run build

echo "📁 [3/4] Menyiapkan direktori log PM2..."
mkdir -p "$PROJECT_ROOT/logs/pm2"

echo "🚀 [4/4] Memuat ulang semua proses PM2..."
cd "$PROJECT_ROOT"
pm2 reload ecosystem.config.js --update-env

echo "🎉 Deployment Selesai! Layanan PT Wijaya Inovasi Gemilang berjalan dengan lancar."
