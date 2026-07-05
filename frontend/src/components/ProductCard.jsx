import { Link } from "react-router-dom";

import { formatCurrency } from "../utils/format";
import StockBadge from "./StockBadge";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80";

function ProductCard({ product }) {
  const imageUrl = product.imageUrl || FALLBACK_IMAGE;

  return (
    <article className="product-card">
      <Link to={`/products/${product._id}`} tabIndex={-1} aria-hidden="true">
        <img src={imageUrl} alt="" loading="lazy" />
      </Link>
      <div className="product-card-body">
        <div>
          <p className="product-category">{product.category || "Umum"}</p>
          <h3>
            <Link to={`/products/${product._id}`}>{product.name}</Link>
          </h3>
          <p className="product-description">
            {product.description || "Belum ada deskripsi."}
          </p>
        </div>
        <StockBadge stock={product.stock} />
        <div className="product-card-footer">
          <span className="price">{formatCurrency(product.price)}</span>
          <Link
            className="button secondary"
            to={`/products/${product._id}`}
            aria-label={`Lihat detail ${product.name}`}
          >
            Lihat Detail
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
