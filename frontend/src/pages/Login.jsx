import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../context/AuthContext";

function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/";

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(formData);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
      // Only reset here. On success the component navigates away and
      // unmounts, so setting state there would target a dead component.
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="section-header">
        <p className="eyebrow">Akun</p>
        <h1>Masuk</h1>
        <p className="lead">Masuk untuk mengelola katalog Toko Arnol.</p>
      </div>

      <form className="form-panel" onSubmit={handleSubmit}>
        <ErrorMessage message={error} />

        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <p className="auth-switch">
        Belum punya akun? <Link to="/register">Daftar di sini</Link>
      </p>
    </section>
  );
}

export default Login;
