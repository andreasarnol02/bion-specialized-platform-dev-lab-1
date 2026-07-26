const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
const TOKEN_KEY = "toko_arnol_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

export const apiFetch = async (path, options = {}) => {
  const { method = "GET", body, auth = false } = options;
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getStoredToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Server mengirim respons yang tidak valid");
  }

  // A 401 means the stored token is missing, expired, or no longer accepted.
  // Clearing it here and announcing it on `window` lets AuthContext reset to
  // the guest state. The event indirection exists because this module has no
  // access to React hooks, and importing AuthContext would create a cycle --
  // AuthContext imports this module to call /api/auth/me.
  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  if (!response.ok) {
    throw new Error(result.message || "Permintaan gagal");
  }

  return result.data;
};
