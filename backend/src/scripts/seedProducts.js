const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Product = require("../models/Product");

dotenv.config();

const products = [
  {
    name: "Headphone Nirkabel",
    description:
      "Headphone over-ear nirkabel dengan peredam bising dan baterai sekitar 30 jam. Nyaman dipakai sepanjang hari.",
    price: 1250000,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    category: "Elektronik",
    stock: 25,
  },
  {
    name: "Keyboard Mekanik",
    description:
      "Keyboard mekanik ukuran 75 persen dengan switch yang bisa diganti. Bisa terhubung lewat Bluetooth atau kabel USB-C.",
    price: 890000,
    imageUrl:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
    category: "Elektronik",
    stock: 40,
  },
  {
    name: "Kamera Instan",
    description:
      "Kamera instan yang langsung mencetak foto kecil setelah dipotret. Ada pengaturan cahaya otomatis dan cermin selfie.",
    price: 1350000,
    imageUrl:
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80",
    category: "Elektronik",
    stock: 12,
  },
  {
    name: "Jam Tangan Analog",
    description:
      "Jam tangan analog dengan casing baja dan tali kulit. Tahan air hingga 5 ATM.",
    price: 2100000,
    imageUrl:
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80",
    category: "Aksesori",
    stock: 15,
  },
  {
    name: "Sepatu Lari",
    description:
      "Sepatu lari ringan dengan bagian atas berbahan jaring dan bantalan busa. Cocok untuk lari harian dan latihan.",
    price: 1500000,
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    category: "Sepatu",
    stock: 30,
  },
  {
    name: "Tas Ransel",
    description:
      "Ransel 28 liter dengan slot laptop 15 inci berlapis busa. Bahan tahan air dengan banyak kantong.",
    price: 760000,
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    category: "Tas",
    stock: 50,
  },
];

const seedProducts = async () => {
  await connectDB();

  console.log(`Database: ${mongoose.connection.name}`);

  let created = 0;
  let updated = 0;

  // Upsert on name rather than insert, so running this twice refreshes the
  // catalogue instead of duplicating it. Product names are the natural key
  // here -- a store does not carry two different items with one name.
  for (const product of products) {
    const result = await Product.updateOne(
      { name: product.name },
      { $set: product },
      { upsert: true, runValidators: true }
    );

    if (result.upsertedCount > 0) {
      created += 1;
      console.log(`  dibuat      ${product.name}`);
    } else {
      updated += 1;
      console.log(`  diperbarui  ${product.name}`);
    }
  }

  const total = await Product.countDocuments();

  console.log("");
  console.log(`Produk dibuat: ${created}, diperbarui: ${updated}`);
  console.log(`Total produk di katalog: ${total}`);

  await mongoose.disconnect();
  process.exit(0);
};

seedProducts().catch(async (error) => {
  console.error("Gagal mengisi produk:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
