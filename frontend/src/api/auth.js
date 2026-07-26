import { apiFetch } from "./client";

export const register = async ({ name, email, password }) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });

export const login = async ({ email, password }) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

export const getMe = async () => apiFetch("/api/auth/me", { auth: true });
