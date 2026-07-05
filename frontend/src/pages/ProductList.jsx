import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getProducts } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import ProductCard from "../components/ProductCard";

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "price-asc", label: "Harga terendah" },
  { value: "price-desc", label: "Harga tertinggi" },
  { value: "name", label: "Nama A-Z" },
];

function sortProducts(products, sortBy) {
  const sorted = [...products];

  switch (sortBy) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "id"));
    default:
      return sorted;
  }
}

function ProductList() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const activeCategory = searchParams.get("category") || "";

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

  const categories = useMemo(
    () => [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ],
    [products]
  );

  const visibleProducts = useMemo(() => {
    let result = products;

    if (activeCategory) {
      result = result.filter(
        (product) => product.category === activeCategory
      );
    }

    if (query.trim()) {
      const keyword = query.trim().toLowerCase();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(keyword)
      );
    }

    return sortProducts(result, sortBy);
  }, [products, activeCategory, query, sortBy]);

  const handleCategoryChange = (category) => {
    if (category) {
      setSearchParams({ category });
    } else {
      setSearchParams({});
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <p className="eyebrow">Katalog</p>
          <h1>Semua Produk</h1>
        </div>
      </div>

      {isLoading && <Loading />}
      <ErrorMessage message={error} />

      {!isLoading && !error && products.length === 0 && (
        <div className="empty-state">
          <h2>Belum ada produk</h2>
          <p>Katalog masih kosong. Produk akan tampil di sini setelah
            ditambahkan dari halaman admin.</p>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <>
          <div className="catalog-toolbar">
            <label className="search-field">
              <span className="visually-hidden">Cari produk</span>
              <input
                type="search"
                placeholder="Cari produk..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <label className="sort-field">
              <span className="visually-hidden">Urutkan produk</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="category-row catalog-categories">
            <button
              type="button"
              className={`category-chip ${activeCategory ? "" : "selected"}`}
              onClick={() => handleCategoryChange("")}
            >
              Semua
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={`category-chip ${
                  activeCategory === category ? "selected" : ""
                }`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <p className="result-count" role="status">
            {visibleProducts.length} produk
            {activeCategory ? ` dalam kategori ${activeCategory}` : ""}
            {query.trim() ? ` untuk pencarian "${query.trim()}"` : ""}
          </p>

          {visibleProducts.length === 0 ? (
            <div className="empty-state">
              <h2>Produk tidak ditemukan</h2>
              <p>Coba ubah kata kunci pencarian atau pilih kategori lain.</p>
            </div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ProductList;
