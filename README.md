# 🐳 Rentverse Backend - Docker Development Guide

Panduan singkat untuk menjalankan aplikasi backend ini menggunakan Docker.

## 📋 Prasyarat

- **Docker Desktop** atau **Docker Engine**
- **Docker Compose**

## 🚀 Cara Menjalankan (Development)

### 1. Persiapan Environment

Salin file environment template:

```bash
cp .env.example .env
```

> **Catatan:** Anda **TIDAK PERLU** mengubah `DATABASE_URL` di dalam folder `.env`. Konfigurasi Docker Compose akan otomatis mengaturnya agar terhubung ke database internal container.

### 2. Persiapan Database (PostgreSQL + PostGIS)

Aplikasi ini membutuhkan PostgreSQL dengan ekstensi **PostGIS**.

Kami telah menyiapkan service database otomatis di dalam `docker-compose.yml` yang menggunakan image `postgis/postgis:15-3.4-alpine`.

**Apa yang terjadi secara otomatis:**

- Container database (`rentverse-db`) akan dibuat.
- Extension PostGIS akan diaktifkan.
- Schema database akan di-push otomatis oleh Prisma saat container aplikasi berjalan.

### 3. Jalankan Aplikasi

Jalankan perintah berikut untuk membangun dan menyalakan semua service:

```bash
docker-compose up -d --build
```

Proses ini akan menjalankan:

1.  🐘 **Database**: PostgreSQL dengan PostGIS port `5432` (internal)
2.  📱 **Backend API**: Node.js server port `3000`
3.  � **Prisma Studio**: Database GUI port `5555`
4.  �🔄 **Proxy**: Caddy server (opsional)

### 4. Verifikasi

Setelah semua container berjalan (status `healthy`):

- **API Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **Dokumentasi API (Swagger)**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Database GUI (Prisma Studio)**: [http://localhost:5555](http://localhost:5555)

### 🖐️ Menghentikan Aplikasi

```bash
docker-compose down
```
