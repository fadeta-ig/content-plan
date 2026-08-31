#!/usr/bin/env bash
# ==============================================================================
# Script Setup Awal Server Ubuntu (Non-Docker)
# PT Wijaya Inovasi Gemilang - Content Plan Platform
# ==============================================================================

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 [1/7] Memperbarui paket sistem Ubuntu..."
sudo apt update && sudo apt upgrade -y

echo "📦 [2/7] Menginstal Python 3.12, Node.js 22 LTS, MySQL 8.0, Nginx, FFmpeg..."
sudo apt install -y python3 python3-pip python3-venv python3-dev \
    mysql-server libmysqlclient-dev pkg-config ffmpeg nginx git curl

# Install Node.js 22 LTS & PM2
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi
sudo npm install -g pm2

echo "🗄️ [3/7] Konfigurasi Database MySQL (utf8mb4)..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS content_plan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "🐍 [4/7] Menyiapkan Virtual Environment Python & Migrasi Database..."
cd "$PROJECT_DIR/backend"

if [ ! -f .env ]; then
    cp .env.example .env
    SECRET_KEY_VALUE="$(openssl rand -hex 48)"
    ENCRYPTION_SALT_VALUE="$(openssl rand -hex 32)"
    DB_PASSWORD_VALUE="$(openssl rand -hex 24)"

    sudo mysql <<SQL
CREATE USER IF NOT EXISTS 'content_user'@'localhost' IDENTIFIED BY '${DB_PASSWORD_VALUE}';
ALTER USER 'content_user'@'localhost' IDENTIFIED BY '${DB_PASSWORD_VALUE}';
GRANT ALL PRIVILEGES ON content_plan.* TO 'content_user'@'localhost';
FLUSH PRIVILEGES;
SQL

    sed -i "s/change-me-to-a-random-string-at-least-32-chars-long/$SECRET_KEY_VALUE/g" .env
    sed -i "s/change-me-to-a-random-salt-string/$ENCRYPTION_SALT_VALUE/g" .env
    sed -i "s#root:password@127.0.0.1:3306#content_user:$DB_PASSWORD_VALUE@127.0.0.1:3306#g" .env
    sed -i "s/^DEBUG=true$/DEBUG=false/" .env
    sed -i "s#^ALLOWED_HOSTS=.*#ALLOWED_HOSTS=creative.wijayainovasi.co.id#" .env
    sed -i "s#^APP_URL=.*#APP_URL=https://creative.wijayainovasi.co.id#" .env
    sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=https://creative.wijayainovasi.co.id#" .env
    sed -i "s#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=https://creative.wijayainovasi.co.id#" .env
    sed -i "s#^CSRF_TRUSTED_ORIGINS=.*#CSRF_TRUSTED_ORIGINS=https://creative.wijayainovasi.co.id#" .env
    printf '\nBB_TRUSTED_PROXIES=127.0.0.1,::1\n' >> .env
    chmod 600 .env
else
    echo "ℹ️  backend/.env sudah ada; kredensial yang tersimpan tidak diubah."
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
npm ci
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
