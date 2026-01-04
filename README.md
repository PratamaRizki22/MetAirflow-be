# RentVerse Backend Service

Backend service untuk RentVerse yang menangani logika bisnis utama, manajemen database, otentikasi, dan integrasi pembayaran.

## ⚙️ Teknologi Utama

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT & Passport (OAuth)
- **Pembayaran:** Stripe API
- **Dokumentasi API:** Swagger UI
- **Storage:** AWS S3 Compatible Strategy (MinIO/S3)
- **Real-time:** Socket.io
- **Containerization:** Docker & Docker Compose

## 🔑 Fitur Dasar

- **Otentikasi User:** Register, Login, Refresh Token, Google OAuth.
- **Manajemen User:** Profil, role (Tenant/Landlord/Admin).
- **Properti:** CRUD properti, pencarian, filter, upload gambar.
- **Booking:** Booking flow, validasi tanggal, kalkulasi harga.
- **Pembayaran:** Payment Intent, Webhook handler, Refund, Payouts.
- **Review & Rating:** Sistem ulasan untuk properti.
- **Chat:** API untuk menyimpan dan mengambil riwayat chat.
- **Notifikasi:** Email notifications (Nodemailer).

## 🚀 Cara Menjalankan

### Opsi 1: Menggunakan Docker (Direkomendasikan)

Cara termudah untuk menjalankan seluruh stack (Backend, Database, Caddy, Prisma Studio) adalah menggunakan Docker Compose.

**Prasyarat:**

- Docker & Docker Compose terinstall.

**Langkah:**

1. **Masuk ke direktori backend:**

   ```bash
   cd rentverse-core-service
   ```

2. **Setup Environment:**
   Salin `.env.example` ke `.env`.

   ```bash
   cp .env.example .env
   ```

   _Catatan: Pastikan `DATABASE_URL` di env file sesuai dengan config docker-compose jika ingin mengubahnya (default sudah terkonfigurasi untuk service `db`)._

3. **Jalankan Container:**

   ```bash
   docker-compose up -d --build
   ```

4. **Akses Layanan:**
   - **API:** `http://localhost:3000`
   - **Swagger Docs:** `http://localhost:3000/api-docs`
   - **Prisma Studio (DB GUI):** `http://localhost:5555`
   - **Caddy (Reverse Proxy):** `http://localhost` (Port 80/443)

### Opsi 2: Manual (Tanpa Docker)

**Prasyarat:**

- Node.js (v18+)
- PostgreSQL Database (running local)
- pnpm (Recommended) atau npm

**Langkah:**

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Konfigurasi Environment:**
   Update `.env` dengan kredensial database lokal Anda.

3. **Setup Database:**

   ```bash
   pnpm run db:generate
   pnpm run db:migrate
   pnpm run db:seed
   ```

4. **Jalankan Server:**
   ```bash
   pnpm run dev
   ```

## 📁 Struktur Direktori

```
rentverse-core-service/
├── src/                  # Source code utama
├── prisma/               # Database schema & migrations
├── scripts/              # Utility scripts
├── tests/                # Unit & Integration tests
├── Dockerfile            # Config Docker image
├── docker-compose.yml    # Config multi-container orchestration
└── index.js              # Entry point server
```

## 🧪 Testing

Jalankan unit dan integration test:

```bash
pnpm test
```

## 💳 Integrasi Stripe

Backend ini menangani full cycle pembayaran:

1. **Create Payment Intent:** Saat user checkout di mobile app.
2. **Webhook Handler:** Menerima notifikasi dari Stripe saat pembayaran sukses/gagal.
3. **Connect Accounts:** Onboarding landlord untuk menerima pembayaran (sub-merchant).

Untuk mengetes webhook lokal:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

---

Happy Coding! 🚀
