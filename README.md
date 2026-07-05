# Toko Arnol - Toko Web Online

Aplikasi web toko online full-stack untuk Tugas Personal Lab ke-1 (TP1) Week 6 mata kuliah Specialized Platform Development.

Bagian depan situs berfungsi seperti toko online pada umumnya: pengunjung dapat melihat katalog, memfilter berdasarkan kategori, mencari, mengurutkan, dan membuka detail produk. Pengelolaan produk (tambah, ubah, hapus) dilakukan lewat halaman admin yang terpisah.

- Frontend: React (Vite) dengan React Router, layout menggunakan CSS Grid dan Flexbox
- Backend: REST API dengan Node.js + Express
- Database: MongoDB (Mongoose)

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

Catatan: pada aplikasi produksi, route admin seharusnya dilindungi autentikasi. Autentikasi berada di luar cakupan tugas ini, jadi halaman admin dibiarkan terbuka.

## API

Base URL: `http://localhost:5001`

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/products` | Mengambil semua produk |
| GET | `/api/products/:id` | Mengambil satu produk |
| POST | `/api/products` | Menambah produk baru |
| PUT | `/api/products/:id` | Mengubah produk |
| DELETE | `/api/products/:id` | Menghapus produk |

Respons memakai bentuk `{ "success": true, "data": ... }`. Jika terjadi kesalahan, respons berbentuk `{ "success": false, "message": "..." }`.

Field produk: `name`, `description`, `price`, `imageUrl`, `category`, `stock`, ditambah timestamp `createdAt` / `updatedAt`.

## Cara Menjalankan

### Prasyarat

- Node.js versi 18 atau lebih baru
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

Backend, buat file `backend/.env`:

```txt
PORT=5001
MONGODB_URI=mongodb://localhost:27017/online-store
CLIENT_URL=http://localhost:5173
```

Jika memakai Atlas, ganti `MONGODB_URI` dengan connection string dari Atlas, contohnya
`mongodb+srv://user:password@cluster.mongodb.net/online-store`.

Frontend, buat file `frontend/.env`:

```txt
VITE_API_URL=http://localhost:5001
```

### 3. Jalankan backend

```bash
cd backend
npm install
npm run dev
```

API berjalan di `http://localhost:5001`. Buka alamat itu di browser, seharusnya muncul pesan status dalam bentuk JSON.

### 4. Jalankan frontend

Di terminal kedua:

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

### 5. Tambah data produk

Database awalnya kosong. Tambahkan produk lewat halaman admin di `http://localhost:5173/admin/new`, atau lewat curl:

```bash
curl -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Kamera Instan","description":"Kamera instan yang langsung mencetak foto.","price":1350000,"imageUrl":"https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80","category":"Elektronik","stock":12}'
```

## Struktur Project

```txt
TP1/
  README.md
  frontend/
    package.json
    index.html
    vite.config.js
    src/
      main.jsx
      App.jsx
      api/
        products.js
      components/
        Navbar.jsx
        Footer.jsx
        ProductCard.jsx
        ProductForm.jsx
        StockBadge.jsx
        Loading.jsx
        ErrorMessage.jsx
      pages/
        Home.jsx
        ProductList.jsx
        ProductDetail.jsx
        AdminProducts.jsx
        CreateProduct.jsx
        EditProduct.jsx
      styles/
        global.css
      utils/
        format.js
  backend/
    package.json
    server.js
    src/
      config/
        db.js
      models/
        Product.js
      controllers/
        productController.js
      routes/
        productRoutes.js
      middleware/
        errorHandler.js
```
