const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PRODUCT_ENDPOINT = `${API_URL}/api/products`;

const parseResponse = async (response) => {
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Request failed");
  }

  return result.data;
};

export const getProducts = async () => {
  const response = await fetch(PRODUCT_ENDPOINT);
  return parseResponse(response);
};

export const getProductById = async (id) => {
  const response = await fetch(`${PRODUCT_ENDPOINT}/${id}`);
  return parseResponse(response);
};

export const createProduct = async (productData) => {
  const response = await fetch(PRODUCT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(productData),
  });

  return parseResponse(response);
};

export const updateProduct = async (id, productData) => {
  const response = await fetch(`${PRODUCT_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(productData),
  });

  return parseResponse(response);
};

export const deleteProduct = async (id) => {
  const response = await fetch(`${PRODUCT_ENDPOINT}/${id}`, {
    method: "DELETE",
  });

  return parseResponse(response);
};
