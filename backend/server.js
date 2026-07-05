const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

const connectDB = require("./src/config/db");
const errorHandler = require("./src/middleware/errorHandler");
const productRoutes = require("./src/routes/productRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Toko Arnol berjalan",
  });
});

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
