import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../api/client";
import {
  getMe,
  login as loginRequest,
  register as registerRequest,
} from "../api/auth";
import { trackEvent } from "../utils/analytics";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Three states, not a boolean. Starting at "guest" would make ProtectedRoute
  // redirect on the very first render -- before the stored token has been read
  // and checked -- so refreshing on /admin would bounce to /login every time.
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!getStoredToken()) {
      setStatus("guest");
      return undefined;
    }

    let active = true;

    // Ask the server rather than decoding the token here. A token can be
    // expired or signed with a rotated secret; only the server can say.
    getMe()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        clearStoredToken();
        setUser(null);
        setStatus("guest");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStatus("guest");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    trackEvent("login", { method: "password" });
    return data.user;
  }, []);

  const register = useCallback(async (details) => {
    const data = await registerRequest(details);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    trackEvent("sign_up", { method: "password" });
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setStatus("guest");
    trackEvent("logout");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }

  return context;
}
