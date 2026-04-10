# SecurityPass — Deployment Runbook

## Prerequisites

- Node.js 18+  (`node --version`)
- PostgreSQL 14+  (`psql --version`)
- PM2  (`npm install -g pm2`)
- Nginx  (`nginx -v`)
- Certbot  (`certbot --version`)

---

## 1. Clone & Install

```bash
git clone <your-repo-url> /opt/securitypass
cd /opt/securitypass
npm install --omit=dev
```

---

## 2. Environment

```bash
cp .env.production.example .env
nano .env   # fill every value — especially DB_PASSWORD and JWT_SECRET
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. Database Setup

```bash
# Create DB user and database (run as postgres superuser)
sudo -u postgres psql <<SQL
CREATE USER sp_user WITH PASSWORD 'your_strong_password';
CREATE DATABASE securitypass OWNER sp_user;
GRANT ALL PRIVILEGES ON DATABASE securitypass TO sp_user;
SQL

# Run migrations and seed
npm run db:migrate
npm run db:seed
```

---

## 4. Start with PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

Check status:
```bash
pm2 status
pm2 logs securitypass
```

---

## 5. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/securitypass`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 15M;

    location / {
        proxy_pass         http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/securitypass /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 6. SSL via Let's Encrypt

```bash
certbot --nginx -d yourdomain.com
```

---

## 7. Post-Deploy Smoke Tests

```bash
# Health check
curl https://yourdomain.com/api/health
# Expected: {"status":"ok","uptime":...,"env":"production"}

# Login check
curl -s -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@securitypass.local","password":"<your-admin-password>"}' \
  | jq '.success'
# Expected: true

# Frontend check
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com
# Expected: 200
```

---

## 8. Maintenance

```bash
# Restart app
pm2 restart securitypass

# View logs
pm2 logs securitypass --lines 100

# Update app
git pull
npm install --omit=dev
pm2 restart securitypass
```

---

## Key File Locations

| File | Purpose |
|------|---------|
| `src/backend/server.js` | Express entry point |
| `src/frontend/index.html` | Single-file SPA frontend |
| `migrations/` | Database schema scripts |
| `seeds/` | Seed data |
| `ecosystem.config.js` | PM2 process config |
| `.env` | Environment variables (never commit) |
| `.env.production.example` | Template for production env |
