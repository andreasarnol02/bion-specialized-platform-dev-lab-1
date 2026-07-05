import { useState } from "react";

const initialValues = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  category: "",
  stock: "",
};

function ProductForm({ initialProduct, isSubmitting, onSubmit, submitLabel }) {
  const [formData, setFormData] = useState({
    ...initialValues,
    ...initialProduct,
    price: initialProduct?.price ?? "",
    stock: initialProduct?.stock ?? "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      ...formData,
      price: Number(formData.price),
      stock: Number(formData.stock || 0),
    });
  };

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <label>
        Nama produk
        <input
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Deskripsi
        <textarea
          name="description"
          rows="4"
          value={formData.description}
          onChange={handleChange}
        />
      </label>

      <div className="form-grid">
        <label>
          Harga (Rp)
          <input
            name="price"
            type="number"
            min="0"
            value={formData.price}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Stok
          <input
            name="stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleChange}
          />
        </label>
      </div>

      <label>
        Kategori
        <input
          name="category"
          type="text"
          value={formData.category}
          onChange={handleChange}
        />
      </label>

      <label>
        URL gambar
        <span className="field-hint">
          Tautan gambar produk, misalnya dari Unsplash.
        </span>
        <input
          name="imageUrl"
          type="url"
          value={formData.imageUrl}
          onChange={handleChange}
        />
      </label>

      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}

export default ProductForm;
