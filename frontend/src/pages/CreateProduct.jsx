import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createProduct } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import ProductForm from "../components/ProductForm";
import { trackEvent } from "../utils/analytics";

function CreateProduct() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (productData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const created = await createProduct(productData);
      trackEvent("admin_product_create", { item_id: created._id });
      navigate("/admin");
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="form-layout">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Tambah Produk</h1>
        </div>
      </div>
      <ErrorMessage message={error} />
      <ProductForm
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitLabel="Simpan Produk"
      />
      <div className="action-row">
        <Link className="button secondary" to="/admin">
          Kembali ke Kelola Produk
        </Link>
      </div>
    </section>
  );
}

export default CreateProduct;
