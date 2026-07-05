function ErrorMessage({ message }) {
  if (!message) {
    return null;
  }

  return (
    <p className="error-message" role="alert">
      {message}
    </p>
  );
}

export default ErrorMessage;
