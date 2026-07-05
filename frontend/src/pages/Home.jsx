import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getProducts } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import ProductCard from "../components/ProductCard";
import { formatCurrency } from "../utils/format";

const FEATURED_COUNT = 4;

function Home() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  const heroProduct = products[0];
  const featured = products.slice(0, FEATURED_COUNT);
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Toko Arnol</p>
          <h1>Produk sehari-hari dengan harga wajar.</h1>
          <p className="lead">
            Toko Arnol adalah toko online kecil untuk produk elektronik,
            aksesori, dan kebutuhan harian. Lihat katalog, buka detail produk,
            dan cek stok sebelum memesan.
          </p>
          <div className="action-row">
            <Link className="button primary" to="/products">
              Lihat Produk
            </Link>
            {heroProduct && (
              <Link
                className="button secondary"
                to={`/products/${heroProduct._id}`}
              >
                Produk Unggulan
              </Link>
            )}
          </div>
        </div>

        {heroProduct && (
          <div className="hero-media">
            <img src={heroProduct.imageUrl} alt={heroProduct.name} />
            <div className="hero-tag">
              <span>{heroProduct.name}</span>
              <strong>{formatCurrency(heroProduct.price)}</strong>
            </div>
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className="home-section" aria-label="Belanja per kategori">
          <div className="section-header">
            <h2>Belanja per Kategori</h2>
          </div>
          <div className="category-row">
            {categories.map((category) => (
              <Link
                className="category-chip"
                key={category}
                to={`/products?category=${encodeURIComponent(category)}`}
              >
                {category}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="home-section" aria-label="Produk unggulan">
        <div className="section-header">
          <h2>Produk Unggulan</h2>
          <Link className="section-link" to="/products">
            Lihat semua produk
          </Link>
        </div>

        {isLoading && <Loading />}
        <ErrorMessage message={error} />

        {!isLoading && !error && products.length === 0 && (
          <div className="empty-state">
            <h2>Toko masih kosong</h2>
            <p>Tambahkan produk pertama untuk mengisi katalog.</p>
            <Link className="button primary" to="/admin/new">
              Tambah Produk
            </Link>
          </div>
        )}

        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </section>

      <div className="service-strip">
        <article>
          <h3>Pengiriman ke seluruh Indonesia</h3>
          <p>Pesanan dikemas dan dikirim dalam 1 sampai 2 hari kerja.</p>
        </article>
        <article>
          <h3>Stok tampil di setiap produk</h3>
          <p>Setiap halaman produk menampilkan jumlah stok yang tersisa.</p>
        </article>
        <article>
          <h3>Harga dalam Rupiah</h3>
          <p>Harga yang tampil di halaman produk adalah harga penuh.</p>
        </article>
      </div>
    </>
  );
}

export default Home;
