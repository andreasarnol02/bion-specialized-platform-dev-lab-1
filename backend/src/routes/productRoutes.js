const express = require("express");

const {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} = require("../controllers/productController");

const router = express.Router();

router.route("/").get(getProducts).post(createProduct);
router.route("/:id").get(getProductById).put(updateProduct).delete(deleteProduct);

module.exports = router;
