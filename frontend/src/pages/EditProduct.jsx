import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getProductById, updateProduct } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import ProductForm from "../components/ProductForm";
import { trackEvent } from "../utils/analytics";

function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await getProductById(id);
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleSubmit = async (productData) => {
    setIsSubmitting(true);
    setError("");

    try {
      await updateProduct(id, productData);
      trackEvent("admin_product_update", { item_id: id });
      navigate("/admin");
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <section className="form-layout">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Ubah Produk</h1>
        </div>
      </div>
      <ErrorMessage message={error} />
      {product && (
        <ProductForm
          initialProduct={product}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitLabel="Simpan Perubahan"
        />
      )}
      <div className="action-row">
        <Link className="button secondary" to="/admin">
          Kembali ke Kelola Produk
        </Link>
      </div>
    </section>
  );
}

export default EditProduct;
