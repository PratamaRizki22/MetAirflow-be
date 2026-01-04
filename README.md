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
- **Testing:** Jest

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

### Prasyarat

- Node.js (v18+)
- PostgreSQL Database
- pnpm (Recommended) atau npm

### Instalasi & Setup

1. **Masuk ke direktori backend:**

   ```bash
   cd rentverse-core-service
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

   _(Jika belum punya pnpm: `npm install -g pnpm`)_

3. **Konfigurasi Environment:**
   Salin `.env.example` ke `.env`.

   ```bash
   cp .env.example .env
   ```

   **Wajib diisi:**
   - `DATABASE_URL`: Connection string PostgreSQL.
   - `JWT_SECRET`: Secret key untuk token.
   - `STRIPE_SECRET_KEY`: Private key dari dashboard Stripe.
   - `AWS_*`: Konfigurasi S3/MinIO untuk upload gambar.

4. **Setup Database:**

   ```bash
   pnpm run db:generate   # Generate Prisma Client
   pnpm run db:migrate    # Jalankan migrasi database
   pnpm run db:seed       # (Opsional) Isi data awal/dummy
   ```

5. **Jalankan Server (Development):**
   ```bash
   pnpm run dev
   ```
   Server akan berjalan di `http://localhost:3000`.

### Dokumentasi API (Swagger)

Setelah server berjalan, dokumentasi lengkap API tersedia di:
👉 **http://localhost:3000/api-docs**

## 📁 Struktur Direktori

```
rentverse-core-service/
├── src/
│   ├── config/             # Konfigurasi env & library
│   ├── constants/          # Konstanta global
│   ├── middleware/         # Auth, Error handling, Validation middleware
│   ├── modules/            # Modular architecture (Controller, Service, Repository)
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── payments/
│   │   ├── properties/
│   │   └── users/
│   ├── routes/             # Route definitions
│   ├── utils/              # Helper functions
│   └── app.js              # Express app setup
├── prisma/
│   ├── schema.prisma       # Skema Database
│   ├── migrations/         # File migrasi SQL
│   └── seeders/            # Data seeding script
├── scripts/                # Utility scripts
├── tests/                  # Unit & Integration tests
└── index.js                # Entry point server
```

## 🧪 Testing

Jalankan unit dan integration test:

```bash
pnpm test
```

Untuk melihat coverage code:

```bash
pnpm test:coverage
```

## 💳 Integrasi Stripe

Backend ini menangani full cycle pembayaran:

1. **Create Payment Intent:** Saat user checkout di mobile app.
2. **Webhook Handler:** Menerima notifikasi dari Stripe saat pembayaran sukses/gagal.
3. **Connect Accounts:** Onboarding landlord untuk menerima pembayaran (sub-merchant).

Pastikan Stripe Webhook CLI berjalan saat development lokal untuk mengetes webhook:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

---

Happy Coding! 🚀
