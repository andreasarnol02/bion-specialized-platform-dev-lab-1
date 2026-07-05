import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getProductById } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import StockBadge from "../components/StockBadge";
import { formatCurrency } from "../utils/format";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
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

  if (isLoading) {
    return <Loading />;
  }

  if (error && !product) {
    return (
      <>
        <ErrorMessage message={error} />
        <div className="action-row">
          <Link className="button secondary" to="/products">
            Kembali ke Produk
          </Link>
        </div>
      </>
    );
  }

  const imageUrl = product.imageUrl || FALLBACK_IMAGE;

  return (
    <section className="detail-layout">
      <img className="detail-image" src={imageUrl} alt={product.name} />

      <div className="detail-content">
        <p className="eyebrow">{product.category || "Umum"}</p>
        <h1>{product.name}</h1>
        <p>{product.description || "Belum ada deskripsi."}</p>

        <div className="detail-meta">
          <span className="price">{formatCurrency(product.price)}</span>
          <StockBadge stock={product.stock} />
        </div>

        <dl className="detail-list">
          <div>
            <dt>Kategori</dt>
            <dd>{product.category || "Umum"}</dd>
          </div>
          <div>
            <dt>Stok</dt>
            <dd>{product.stock} unit</dd>
          </div>
        </dl>

        <div className="action-row">
          <Link className="button secondary" to="/products">
            Kembali ke Produk
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ProductDetail;
