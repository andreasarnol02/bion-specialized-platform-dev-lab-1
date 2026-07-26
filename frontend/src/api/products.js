import { apiFetch } from "./client";

const PRODUCT_PATH = "/api/products";

export const getProducts = async () => apiFetch(PRODUCT_PATH);

export const getProductById = async (id) => apiFetch(`${PRODUCT_PATH}/${id}`);

export const createProduct = async (productData) =>
  apiFetch(PRODUCT_PATH, {
    method: "POST",
    body: productData,
    auth: true,
  });

export const updateProduct = async (id, productData) =>
  apiFetch(`${PRODUCT_PATH}/${id}`, {
    method: "PUT",
    body: productData,
    auth: true,
  });

export const deleteProduct = async (id) =>
  apiFetch(`${PRODUCT_PATH}/${id}`, {
    method: "DELETE",
    auth: true,
  });
