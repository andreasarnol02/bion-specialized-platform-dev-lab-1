import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, status, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Langsung ke konten utama
      </a>
      <nav className="nav" aria-label="Navigasi utama">
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 7h12l1 13H5L6 7z" />
              <path d="M9 10V6a3 3 0 0 1 6 0v4" />
            </svg>
          </span>
          Toko Arnol
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            Beranda
          </NavLink>
          <NavLink
            to="/products"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Produk
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Admin
            </NavLink>
          )}

          {/* Neither branch renders while status is "loading". Showing nothing
              for that moment beats flashing "Masuk" and swapping it for the
              user's name once the stored token has been validated. */}
          {status === "authenticated" ? (
            <div className="nav-user">
              <span className="nav-user-name">Halo, {user.name}</span>
              <button className="button ghost" type="button" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          ) : (
            status === "guest" && (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  Masuk
                </NavLink>
                <NavLink to="/register" className="nav-cta">
                  Daftar
                </NavLink>
              </>
            )
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
