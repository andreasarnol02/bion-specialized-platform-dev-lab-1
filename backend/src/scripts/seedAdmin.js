const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const seedAdmin = async () => {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diatur di environment"
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = "admin";
    await existing.save();
    console.log(`Akun ${existing.email} dipromosikan menjadi admin`);
  } else {
    const admin = await User.create({ name, email, password, role: "admin" });
    console.log(`Admin ${admin.email} berhasil dibuat`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch(async (error) => {
  console.error("Gagal membuat admin:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
