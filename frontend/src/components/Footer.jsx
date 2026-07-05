import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>Toko Arnol, toko online untuk produk sehari-hari.</p>
        <nav className="footer-links" aria-label="Navigasi footer">
          <Link to="/">Beranda</Link>
          <Link to="/products">Produk</Link>
          <Link to="/admin">Admin</Link>
        </nav>
        <p>Dibuat dengan React, Express, dan MongoDB.</p>
      </div>
    </footer>
  );
}

export default Footer;
