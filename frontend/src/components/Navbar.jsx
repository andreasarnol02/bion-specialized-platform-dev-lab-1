import { NavLink } from "react-router-dom";

function Navbar() {
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
          <NavLink
            to="/admin"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Admin
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
