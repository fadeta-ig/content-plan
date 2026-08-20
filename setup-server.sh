#!/usr/bin/env bash
# ==============================================================================
# Script Setup Awal Server Ubuntu (Non-Docker)
# PT Wijaya Inovasi Gemilang - Content Plan Platform
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 [1/7] Memperbarui paket sistem Ubuntu..."
sudo apt update && sudo apt upgrade -y

echo "📦 [2/7] Menginstal Python 3.12, Node.js 20, MySQL 8.0, Nginx, FFmpeg..."
sudo apt install -y python3 python3-pip python3-venv python3-dev \
    mysql-server libmysqlclient-dev pkg-config ffmpeg nginx git curl

# Install Node.js 20 LTS & PM2
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
sudo npm install -g pm2

echo "🗄️ [3/7] Konfigurasi Database MySQL (utf8mb4)..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS content_plan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'content_user'@'localhost' IDENTIFIED BY 'WijayaPlanPass2026!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON content_plan.* TO 'content_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo "🐍 [4/7] Menyiapkan Virtual Environment Python & Migrasi Database..."
cd "$PROJECT_DIR/backend"

if [ ! -f .env ]; then
    cp .env.example .env
    RANDOM_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    sed -i "s/change-me-to-a-random-string-at-least-32-chars-long/$RANDOM_KEY/g" .env
    sed -i "s/root:password@127.0.0.1:3306/content_user:WijayaPlanPass2026!@127.0.0.1:3306/g" .env
fi

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create media directory for local storage
mkdir -p media staticfiles ../logs/pm2

echo "🗄️ [5/7] Eksekusi Migrasi Database & Static Files..."
python3 manage.py migrate --noinput
python3 manage.py collectstatic --noinput

echo "⚛️ [6/7] Membangun Frontend Next.js..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build

echo "⚡ [7/7] Menjalankan Proses dengan PM2..."
cd "$PROJECT_DIR"
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo "=========================================================================="
echo "✅ Setup Berhasil! Sistem Content Plan PT Wijaya Inovasi Gemilang aktif."
echo "   - Next.js UI: http://127.0.0.1:3000"
echo "   - Django Engine API: http://127.0.0.1:8000"
echo "   - Nginx Config: Salin $PROJECT_DIR/nginx.conf ke /etc/nginx/sites-available/"
echo "=========================================================================="
