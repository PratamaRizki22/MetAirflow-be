# 🐳 Docker Deployment Guide - Rentverse Backend

Dokumentasi lengkap untuk deployment Rentverse Backend menggunakan Docker dan Caddy sebagai reverse proxy.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose V2+
- File `.env` yang sudah dikonfigurasi dengan benar

## 🏗️ Arsitektur

```
┌─────────────────┐
│   Client        │
└────────┬────────┘
         │ HTTP/HTTPS
         ▼
┌─────────────────┐
│  Caddy Proxy    │  (:80, :443)
│  - Auto HTTPS   │
│  - Security     │
│  - Compression  │
└────────┬────────┘
         │ Internal Network
         ▼
┌─────────────────┐
│  Rentverse App  │  (:3000)
│  - Node.js      │
│  - Express      │
│  - Prisma       │
└────────┬────────┘
         │ Connection via .env
         ▼
┌─────────────────┐
│  PostgreSQL DB  │  (External)
│  Redis, etc     │
└─────────────────┘
```

## 🚀 Quick Start

### 1. Persiapan Environment

Pastikan file `.env` sudah ada dan dikonfigurasi dengan benar:

```bash
cp .env.example .env
# Edit .env sesuai konfigurasi production Anda
```

**Penting**: Pastikan `DATABASE_URL` dan konfigurasi lainnya sudah benar!

### 2. Build dan Run

#### Development / Testing

```bash
# Build image
docker compose build

# Run services
docker compose up -d

# View logs
docker compose logs -f
```

#### Production

```bash
# Build image tanpa cache
docker compose build --no-cache

# Run services in production mode
docker compose up -d

# Check status
docker compose ps
```

### 3. Verifikasi

```bash
# Health check
curl http://localhost/health

# API Documentation
curl http://localhost/docs

# Check logs
docker compose logs -f app
docker compose logs -f caddy
```

## 📦 Docker Files

### Dockerfile

Multi-stage build dengan optimasi:

1. **Stage 1 (deps)**: Install dependencies
2. **Stage 2 (builder)**: Generate Prisma client
3. **Stage 3 (runner)**: Production runtime

**Fitur:**

- Base image: `node:20-alpine` (minimal size)
- Package manager: `pnpm` (fast & efficient)
- Non-root user untuk security
- Health check built-in
- Production dependencies only

### Caddyfile

Reverse proxy dengan fitur:

- ✅ Automatic HTTPS (Let's Encrypt)
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Gzip/Zstd compression
- ✅ Rate limiting (optional)
- ✅ Static file caching
- ✅ Load balancing support
- ✅ Custom error pages

### docker-compose.yml

Orchestration dengan:

- Service: `app` (backend application)
- Service: `caddy` (reverse proxy)
- Network: `rentverse-network` (isolated)
- Volumes: `uploads_data`, `caddy_data`, `caddy_config`
- Health checks
- Resource limits

## 🔧 Commands

### Basic Operations

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f [service_name]

# Check status
docker compose ps

# Execute command in container
docker compose exec app sh
```

### Database Operations

```bash
# Run migrations
docker compose exec app pnpm run db:deploy

# Generate Prisma client
docker compose exec app pnpm run db:generate

# Seed database
docker compose exec app pnpm run db:seed

# Access Prisma Studio
docker compose exec app pnpm run db:studio
```

### Maintenance

```bash
# Update image
docker compose pull
docker compose up -d

# Rebuild image
docker compose build --no-cache
docker compose up -d

# Clean up
docker compose down -v  # Warning: removes volumes!
docker system prune -a
```

## 🔐 Security Best Practices

### 1. Environment Variables

```bash
# Jangan commit .env ke repository!
# Gunakan secrets management untuk production:
# - Docker Secrets
# - Kubernetes Secrets
# - AWS Secrets Manager
# - HashiCorp Vault
```

### 2. Update Caddyfile untuk Production

```caddyfile
# Ganti :80 dengan domain Anda
yourdomain.com {
    # Email untuk Let's Encrypt
    tls your-email@example.com

    # ... rest of configuration
}
```

### 3. Network Security

```bash
# Pastikan hanya port yang diperlukan yang exposed
# Default: 80 (HTTP), 443 (HTTPS)
# App port 3000 TIDAK exposed ke host
```

### 4. Update Regular

```bash
# Update base images secara berkala
docker compose pull
docker compose up -d
```

## 🎯 Production Deployment

### 1. Environment Configuration

Update `.env` untuk production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db-host:5432/rentverse

# JWT Secret (gunakan yang strong!)
JWT_SECRET=your-very-secure-random-secret-key-here

# Base URLs
BASE_URL=https://yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 2. Caddy Configuration

Edit `Caddyfile`:

```caddyfile
{
    email admin@yourdomain.com
}

yourdomain.com {
    # Your configuration
}
```

### 3. SSL Certificates

Caddy akan otomatis mendapatkan SSL certificate dari Let's Encrypt.

Pastikan:

- Domain sudah mengarah ke server
- Port 80 dan 443 terbuka di firewall
- Email valid untuk notifikasi certificate

### 4. Monitoring

```bash
# Setup monitoring menggunakan:
# - Docker stats
# - Prometheus + Grafana
# - Caddy metrics
# - Application logs
```

## 🐛 Troubleshooting

### App tidak bisa connect ke database

```bash
# Check DATABASE_URL di .env
docker compose exec app sh
echo $DATABASE_URL

# Test koneksi dari container
docker compose exec app pnpm run db:generate
```

### Caddy tidak bisa mendapatkan SSL certificate

```bash
# Check logs
docker compose logs caddy

# Pastikan:
# - Domain sudah mengarah ke server
# - Port 80 & 443 terbuka
# - Email valid di Caddyfile
```

### Container terus restart

```bash
# Check logs
docker compose logs -f app

# Check health
docker compose ps

# Debug mode
docker compose exec app sh
```

### Permission denied pada /app/uploads

```bash
# Fix ownership
docker compose exec -u root app chown -R expressjs:nodejs /app/uploads
```

### Prisma Client tidak ter-generate

```bash
# Generate manual
docker compose exec app pnpm run db:generate
docker compose restart app
```

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f caddy

# Last N lines
docker compose logs --tail=100 app
```

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats rentverse-backend
```

## 🔄 Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild & restart
docker compose build --no-cache app
docker compose up -d app
```

### Update Dependencies

```bash
# Rebuild image
docker compose build --no-cache
docker compose up -d
```

### Backup

```bash
# Backup uploads
docker run --rm -v rentverse_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .

# Backup database (dari server database)
pg_dump rentverse > rentverse-backup.sql
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-elastic-beanstalk)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

## 💡 Tips

1. **Use .dockerignore**: Sudah dikonfigurasi untuk mengecualikan file yang tidak perlu
2. **Multi-stage builds**: Menghasilkan image yang lebih kecil (~150MB vs ~1GB)
3. **Health checks**: Memastikan container healthy sebelum menerima traffic
4. **Non-root user**: Meningkatkan security
5. **Resource limits**: Mencegah container menggunakan terlalu banyak resources

---

**Happy Deploying! 🚀**
