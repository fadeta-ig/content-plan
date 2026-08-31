const path = require('path');

const projectRoot = __dirname;
const logDirectory = path.join(projectRoot, 'logs', 'pm2');

module.exports = {
  apps: [
    {
      name: 'creative-backend',
      cwd: path.join(projectRoot, 'backend'),
      script: path.join(projectRoot, 'backend', 'venv', 'bin', 'gunicorn'),
      args: 'config.wsgi:application --bind 127.0.0.1:8050 --workers 2 --threads 2 --timeout 120 --preload',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings.production',
        PYTHONUNBUFFERED: '1',
      },
      autorestart: true,
      max_memory_restart: '400M',
      max_restarts: 10,
      restart_delay: 2000,
      error_file: path.join(logDirectory, 'creative-backend-err.log'),
      out_file: path.join(logDirectory, 'creative-backend-out.log'),
    },
    {
      name: 'creative-worker',
      cwd: path.join(projectRoot, 'backend'),
      script: path.join(projectRoot, 'backend', 'venv', 'bin', 'python'),
      args: 'manage.py process_tasks --duration 0 --sleep 15',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings.production',
        PYTHONUNBUFFERED: '1',
      },
      autorestart: true,
      max_memory_restart: '500M',
      max_restarts: 10,
      restart_delay: 2000,
      error_file: path.join(logDirectory, 'creative-worker-err.log'),
      out_file: path.join(logDirectory, 'creative-worker-out.log'),
    },
    {
      name: 'creative-frontend',
      cwd: path.join(projectRoot, 'frontend'),
      script: path.join(projectRoot, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3050',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3050,
        NEXT_PUBLIC_API_URL: 'https://creative.wijayainovasi.co.id',
      },
      autorestart: true,
      max_memory_restart: '600M',
      max_restarts: 10,
      restart_delay: 2000,
      error_file: path.join(logDirectory, 'creative-frontend-err.log'),
      out_file: path.join(logDirectory, 'creative-frontend-out.log'),
    },
  ],
};
