import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../context/AuthContext";

function Register() {
  const { register, status } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Fast feedback only. The server enforces the same 6-character minimum
    // through the Mongoose validator, which is the check that matters.
    if (formData.password !== formData.confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="section-header">
        <p className="eyebrow">Akun</p>
        <h1>Daftar</h1>
        <p className="lead">Buat akun untuk mulai berbelanja di Toko Arnol.</p>
      </div>

      <form className="form-panel" onSubmit={handleSubmit}>
        <ErrorMessage message={error} />

        <label>
          Nama lengkap
          <input
            name="name"
            type="text"
            autoComplete="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </label>

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
          <span className="field-hint">Minimal 6 karakter.</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Konfirmasi password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </label>

        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Daftar"}
        </button>
      </form>

      <p className="auth-switch">
        Sudah punya akun? <Link to="/login">Masuk di sini</Link>
      </p>
    </section>
  );
}

export default Register;
