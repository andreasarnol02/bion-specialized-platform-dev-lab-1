const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

const connectDB = require("./src/config/db");
const errorHandler = require("./src/middleware/errorHandler");
const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Render and Vercel put a reverse proxy in front of the app, so the socket
// address is the proxy's, not the visitor's. Trusting one hop makes
// `req.ip` read the first entry of X-Forwarded-For, which is what the rate
// limiter keys on -- without it every request looks like one client and a
// single attacker would exhaust the limit for everybody.
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Toko Arnol berjalan",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
