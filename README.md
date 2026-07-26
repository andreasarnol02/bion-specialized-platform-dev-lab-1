# Toko Arnol - Toko Web Online

Aplikasi web toko online full-stack untuk Tugas Personal Lab mata kuliah Specialized Platform Development. TP1 (Week 6) membangun katalog produk dan REST API; TP2 (Week 8) menambahkan autentikasi JWT, deployment, dan monitoring.

Bagian depan situs berfungsi seperti toko online pada umumnya: pengunjung dapat melihat katalog, memfilter berdasarkan kategori, mencari, mengurutkan, dan membuka detail produk. Pengelolaan produk (tambah, ubah, hapus) dilakukan lewat halaman admin yang dilindungi login dan hanya bisa diakses akun dengan role `admin`.

- Frontend: React (Vite) dengan React Router, layout menggunakan CSS Grid dan Flexbox
- Backend: REST API dengan Node.js + Express
- Database: MongoDB (Mongoose)
- Autentikasi: JWT, password di-hash dengan bcrypt, token disimpan di `localStorage`
- Monitoring: Google Analytics 4

## Link Deployment

| Bagian | Link |
| --- | --- |
| Frontend (Vercel) | https://toko-online.andreasarnol.com |
| Backend (Render) | https://api-toko-online.andreasarnol.com |

## Halaman

### Publik (toko)

| Route | Halaman | Keterangan |
| --- | --- | --- |
| `/` | Beranda | Hero, kategori, dan produk unggulan dari API |
| `/products` | Semua Produk | Katalog lengkap dengan filter kategori, pencarian, dan pengurutan |
| `/products?category=X` | Katalog terfilter | Filter kategori lewat query param di URL |
| `/products/:id` | Detail Produk | Satu produk dengan harga, stok, dan deskripsi |

### Admin (kelola katalog)

| Route | Halaman | Keterangan |
| --- | --- | --- |
| `/admin` | Kelola Produk | Tabel produk dengan aksi ubah dan hapus |
| `/admin/new` | Tambah Produk | Membuat produk baru |
| `/admin/:id/edit` | Ubah Produk | Mengubah produk yang sudah ada |

Ketiga route admin dilindungi `ProtectedRoute` dan hanya bisa diakses akun dengan role `admin`. Pengunjung yang belum masuk diarahkan ke `/login`; pengguna biasa yang sudah masuk diarahkan ke beranda.

### Akun

| Route | Halaman | Keterangan |
| --- | --- | --- |
| `/login` | Masuk | Login dengan email dan password |
| `/register` | Daftar | Membuat akun baru dengan role `user` |

Registrasi selalu membuat akun dengan role `user`; field `role` pada request body diabaikan. Akun admin pertama dibuat lewat `npm run seed:admin`, bukan lewat halaman registrasi.

## API

Base URL: `http://localhost:5001`

| Method | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Publik | Daftar akun baru, mengembalikan token |
| POST | `/api/auth/login` | Publik | Masuk, mengembalikan token |
| GET | `/api/auth/me` | Token | Data akun yang sedang masuk |
| GET | `/api/products` | Publik | Mengambil semua produk |
| GET | `/api/products/:id` | Publik | Mengambil satu produk |
| POST | `/api/products` | Admin | Menambah produk baru |
| PUT | `/api/products/:id` | Admin | Mengubah produk |
| DELETE | `/api/products/:id` | Admin | Menghapus produk |

Endpoint bertanda Admin memerlukan header `Authorization: Bearer <token>` dari akun dengan role `admin`. Tanpa token responsnya 401; dengan token pengguna biasa responsnya 403.

Respons memakai bentuk `{ "success": true, "data": ... }`. Jika terjadi kesalahan, respons berbentuk `{ "success": false, "message": "..." }`.

Field produk: `name`, `description`, `price`, `imageUrl`, `category`, `stock`, ditambah timestamp `createdAt` / `updatedAt`.

Field akun: `name`, `email`, `role`. Password di-hash dengan bcrypt dan tidak pernah ikut dalam respons API.

### Rate limit

`/api/auth/login` dibatasi 10 percobaan gagal per IP per 15 menit; login yang berhasil tidak dihitung. `/api/auth/register` dibatasi 20 permintaan per IP per jam. `/api/auth/me` tidak dibatasi karena dipanggil setiap halaman dimuat untuk memvalidasi token.

## Cara Menjalankan

### Prasyarat

- Node.js versi 20 atau lebih baru
- MongoDB, bisa salah satu dari:
  - MongoDB Community Server lokal (`brew install mongodb-community` di macOS), atau
  - cluster MongoDB Atlas M0 (gratis)

### 1. Jalankan MongoDB

Lokal (macOS dengan Homebrew):

```bash
brew services start mongodb-community
```

Atau buat cluster di Atlas lalu salin connection string-nya.

### 2. Atur environment variable

Backend, salin `backend/.env.example` menjadi `backend/.env`:

```txt
PORT=5001
MONGODB_URI=mongodb://localhost:27017/online-store
CLIENT_URLS=http://localhost:5173
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter
JWT_EXPIRES_IN=7d
ADMIN_NAME=Nama Admin
ADMIN_EMAIL=admin@tokoarnol.com
ADMIN_PASSWORD=ganti-password-ini
```

`CLIENT_URLS` menerima beberapa origin yang dipisah koma, misalnya
`http://localhost:5173,https://toko-arnol.vercel.app`. Origin di luar daftar ini ditolak CORS.

Untuk `JWT_SECRET`, hasilkan string acak:

```bash
openssl rand -hex 32
```

Jika memakai Atlas, ganti `MONGODB_URI` dengan connection string dari Atlas, contohnya
`mongodb+srv://user:password@cluster.mongodb.net/online-store`.

Frontend, salin `frontend/.env.example` menjadi `frontend/.env`:

```txt
VITE_API_URL=http://localhost:5001
VITE_GA_MEASUREMENT_ID=
```

`VITE_GA_MEASUREMENT_ID` boleh dikosongkan saat pengembangan lokal. Jika kosong, Google Analytics tidak dimuat sama sekali sehingga data pengembangan tidak mencemari dashboard.

### 3. Jalankan backend

```bash
cd backend
npm install
npm run dev
```

API berjalan di `http://localhost:5001`. Buka alamat itu di browser, seharusnya muncul pesan status dalam bentuk JSON.

### 4. Buat akun admin pertama

Registrasi lewat halaman `/register` selalu menghasilkan role `user`. Akun admin dibuat lewat script, memakai kredensial dari `ADMIN_*` di `backend/.env`:

```bash
cd backend
npm run seed:admin
```

Script ini aman dijalankan berulang: jika email tersebut sudah terdaftar, akunnya dipromosikan menjadi admin.

### 5. Jalankan frontend

Di terminal kedua:

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

### 6. Tambah data produk

Database awalnya kosong. Masuk sebagai admin, lalu tambahkan produk lewat `http://localhost:5173/admin/new`.

Lewat curl, ambil token dulu karena endpoint ini butuh role admin:

```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tokoarnol.com","password":"password-admin-anda"}' \
  | sed -nE 's/.*"token":"([^"]+)".*/\1/p')

curl -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Kamera Instan","description":"Kamera instan yang langsung mencetak foto.","price":1350000,"imageUrl":"https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80","category":"Elektronik","stock":12}'
```

## Pengujian

`backend/smoke-test.sh` menguji alur autentikasi dan otorisasi dari ujung ke ujung: baca publik, tulis tanpa token ditolak, registrasi menghasilkan role `user`, tulis sebagai pengguna biasa ditolak, login admin, tulis sebagai admin berhasil, lalu hapus data ujinya.

```bash
cd backend
./smoke-test.sh                                   # lokal
./smoke-test.sh https://toko-arnol-api.onrender.com   # setelah deploy
```

Script keluar dengan kode 0 jika ketujuh pemeriksaan lolos.

## Struktur Project

```txt
TP1/
  README.md
  render.yaml                    Blueprint deployment Render (harus di root repo)
  docs/
    TP2_Dokumentasi.md
  frontend/
    package.json
    index.html
    vite.config.js
    vercel.json                  rewrite SPA agar refresh di /admin tidak 404
    src/
      main.jsx
      App.jsx
      api/
        client.js                apiFetch: base URL, header Bearer, penanganan 401
        auth.js
        products.js
      context/
        AuthContext.jsx          status loading | authenticated | guest
      hooks/
        useAnalytics.js          page_view setiap perpindahan route
      components/
        Navbar.jsx
        Footer.jsx
        ProtectedRoute.jsx
        ProductCard.jsx
        ProductForm.jsx
        StockBadge.jsx
        Loading.jsx
        ErrorMessage.jsx
      pages/
        Home.jsx
        ProductList.jsx
        ProductDetail.jsx
        Login.jsx
        Register.jsx
        AdminProducts.jsx
        CreateProduct.jsx
        EditProduct.jsx
      styles/
        global.css
      utils/
        analytics.js
        format.js
  backend/
    package.json
    server.js
    smoke-test.sh                pengujian alur auth dari ujung ke ujung
    src/
      config/
        db.js
      models/
        Product.js
        User.js
      controllers/
        productController.js
        authController.js
      routes/
        productRoutes.js
        authRoutes.js
      middleware/
        errorHandler.js
        auth.js                  protect + requireAdmin
        rateLimiter.js
      utils/
        generateToken.js
      scripts/
        seedAdmin.js
```

## Deployment

Backend ke Render, frontend ke Vercel, database ke MongoDB Atlas. Ketiganya memakai paket gratis.

Alamat yang dipakai:

| Bagian | Domain | Layanan |
| --- | --- | --- |
| Frontend | `toko-online.andreasarnol.com` | Vercel |
| Backend | `api-toko-online.andreasarnol.com` | Render |

Karena kedua domain sudah ditentukan sejak awal, nilai `CLIENT_URLS` dan `VITE_API_URL` bisa langsung diisi benar pada deploy pertama. Tanpa custom domain, keduanya saling menunggu: `CLIENT_URLS` butuh URL Vercel sementara `VITE_API_URL` butuh URL Render, padahal belum ada yang jadi.

URL bawaan `<proyek>.vercel.app` tetap dimasukkan ke `CLIENT_URLS` sebagai cadangan, supaya aplikasi tetap berfungsi kalau DNS belum menyebar saat pengumpulan.

Ikuti langkah berikut dari atas ke bawah.

### 1. MongoDB Atlas

1. Buat cluster M0 gratis di <https://cloud.mongodb.com>.
2. **Database Access** → tambah user, catat username dan password.
3. **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`).
4. **Connect** → Drivers → salin connection string, ganti `<password>`, lalu tambahkan nama database:
   `mongodb+srv://user:pass@cluster.mongodb.net/online-store?retryWrites=true&w=majority`

`0.0.0.0/0` diperlukan karena paket gratis Render tidak memberi IP keluar yang tetap, jadi tidak ada alamat yang bisa didaftarkan. Koneksinya tetap dilindungi kredensial dan TLS.

### 2. Push ke GitHub

Kedua layanan melakukan deploy dari repository Git.

```bash
git push origin main
```

Pastikan file `.env` tidak ikut terkirim:

```bash
git ls-files | grep -E "\.env$" || echo "aman, tidak ada .env yang dilacak"
```

Jika ada `.env` yang muncul, hapus dengan `git rm --cached` **dan ganti semua kredensial di dalamnya** — secret yang sudah terkirim tetap ada di riwayat commit meski filenya dihapus.

### 3. Deploy backend ke Render

1. <https://dashboard.render.com> → New → Blueprint → pilih repository ini. Render membaca `render.yaml` di root.
2. Isi nilai yang diminta: `MONGODB_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Isi `CLIENT_URLS` sekaligus, dipisah koma tanpa spasi:

   ```txt
   https://toko-online.andreasarnol.com,https://toko-arnol.vercel.app,http://localhost:5173
   ```

   Ganti `toko-arnol.vercel.app` dengan nama proyek Vercel yang akan dipakai di langkah 6.
4. Deploy, lalu buka URL service-nya. Seharusnya muncul `{"success":true,"message":"API Toko Arnol berjalan"}`.

Catat URL bawaannya, bentuknya `https://toko-arnol-api.onrender.com`.

`JWT_SECRET` tidak perlu diisi: `render.yaml` memakai `generateValue: true` sehingga Render membuat secret acak sendiri.

### 4. Pasang domain backend di Render

Render → service → **Settings** → **Custom Domains** → Add Custom Domain:

```txt
api-toko-online.andreasarnol.com
```

Render menampilkan target CNAME. Di Cloudflare, tambahkan:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| CNAME | `api-toko-online` | nilai dari Render | **DNS only** (awan abu-abu) |

Proxy harus dimatikan. Dengan awan oranye, Cloudflare menjawab permintaan validasi ACME dari edge-nya sendiri sehingga Render tidak pernah menerimanya dan sertifikat gagal terbit.

Tunggu sampai status di Render berubah menjadi terverifikasi, lalu buka `https://api-toko-online.andreasarnol.com` untuk memastikan responsnya sama.

### 5. Buat akun admin di database production

Render dashboard → service → tab **Shell**:

```bash
npm run seed:admin
```

Jika service sedang tidur, buka dulu URL-nya supaya bangun.

### 6. Deploy frontend ke Vercel

1. <https://vercel.com/new> → import repository yang sama.
2. **Root Directory** diisi `frontend`.
3. Environment Variables:

   ```txt
   VITE_API_URL=https://api-toko-online.andreasarnol.com
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

   Tanpa garis miring di akhir `VITE_API_URL`. Garis miring menghasilkan path seperti `https://api-toko-online.andreasarnol.com//api/products` yang berujung 404, karena `apiFetch` menyambung string apa adanya.
4. Deploy, catat URL bawaannya.

Kalau nama proyek Vercel ternyata berbeda dari tebakan di langkah 3, perbarui `CLIENT_URLS` di Render agar cocok.

### 7. Pasang domain frontend di Vercel

Vercel → project → **Settings** → **Domains** → Add:

```txt
toko-online.andreasarnol.com
```

Di Cloudflare, tambahkan record sesuai nilai yang ditampilkan Vercel:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| CNAME | `toko-online` | nilai dari Vercel | **DNS only** (awan abu-abu) |

Sama seperti Render, proxy harus dimatikan. Vercel juga tidak menyarankan reverse proxy di depannya: dengan mode SSL "Flexible", Cloudflare menghubungi Vercel lewat HTTP, Vercel mengalihkan ke HTTPS, lalu Cloudflare mengulanginya sehingga muncul `ERR_TOO_MANY_REDIRECTS`.

Karena `CLIENT_URLS` sudah memuat `https://toko-online.andreasarnol.com` sejak langkah 3, tidak ada yang perlu diubah lagi di Render.

### 8. Atur data stream GA4

GA4 → Admin → Data Streams → ubah URL stream menjadi `https://toko-online.andreasarnol.com`, atau tambahkan stream baru untuk domain itu. Stream yang hanya diatur untuk `localhost` tidak merekam trafik production.

### 9. Verifikasi

```bash
cd backend
ADMIN_EMAIL=email-admin-anda ADMIN_PASSWORD=password-anda \
  ./smoke-test.sh https://api-toko-online.andreasarnol.com
```

Harus muncul `Passed: 7   Failed: 0`. Permintaan pertama bisa memakan waktu sekitar 50 detik karena instance gratis Render tidur setelah kurang lebih 15 menit tidak aktif.

Lalu buka `https://toko-online.andreasarnol.com` di browser:

| Pemeriksaan | Harapan |
| --- | --- |
| Beranda menampilkan produk | Data datang dari API Render |
| Buka detail produk lalu refresh | Tetap di halaman itu, tidak 404 (bukti rewrite SPA bekerja) |
| Buka `/admin` tanpa login | Diarahkan ke `/login` |
| Login sebagai admin | Masuk ke `/admin`, bisa menambah produk |
| Console browser | Tidak ada error CORS |
| GA4 Realtime | Kunjungan Anda muncul |
| Gembok HTTPS di address bar | Sertifikat terbit untuk kedua domain |

Periksa juga DNS-nya sudah menyebar:

```bash
dig +short toko-online.andreasarnol.com
dig +short api-toko-online.andreasarnol.com
```

Keduanya harus mengembalikan target CNAME dari Vercel dan Render, bukan kosong.
