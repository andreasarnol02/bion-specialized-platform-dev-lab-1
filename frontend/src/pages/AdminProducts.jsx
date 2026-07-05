import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { deleteProduct, getProducts } from "../api/products";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import StockBadge from "../components/StockBadge";
import { formatCurrency } from "../utils/format";

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
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

  const handleDelete = async (product) => {
    const confirmed = window.confirm(`Hapus produk "${product.name}"?`);

    if (!confirmed) {
      return;
    }

    setDeletingId(product._id);
    setError("");

    try {
      await deleteProduct(product._id);
      setProducts((current) =>
        current.filter((item) => item._id !== product._id)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Kelola Produk</h1>
        </div>
        <Link className="button primary" to="/admin/new">
          Tambah Produk
        </Link>
      </div>

      {isLoading && <Loading />}
      <ErrorMessage message={error} />

      {!isLoading && !error && products.length === 0 && (
        <div className="empty-state">
          <h2>Belum ada produk</h2>
          <p>Tambahkan produk pertama untuk mengisi katalog.</p>
          <Link className="button primary" to="/admin/new">
            Tambah Produk
          </Link>
        </div>
      )}

      {!isLoading && products.length > 0 && (
        <>
          <p className="result-count">{products.length} produk di katalog</p>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Produk</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Harga</th>
                  <th scope="col">Stok</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="table-product">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" loading="lazy" />
                        )}
                        <Link to={`/products/${product._id}`}>
                          {product.name}
                        </Link>
                      </div>
                    </td>
                    <td>{product.category || "Umum"}</td>
                    <td>{formatCurrency(product.price)}</td>
                    <td>
                      <StockBadge stock={product.stock} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button secondary small"
                          to={`/admin/${product._id}/edit`}
                        >
                          Ubah
                        </Link>
                        <button
                          type="button"
                          className="button danger small"
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product._id}
                        >
                          {deletingId === product._id
                            ? "Menghapus..."
                            : "Hapus"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminProducts;
