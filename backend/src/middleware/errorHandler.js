const errorHandler = (error, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = error.message || "Terjadi kesalahan pada server";

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(error.errors)
      .map((item) => item.message)
      .join(", ");
  }

  if (error.code === 11000) {
    statusCode = 400;
    message = "Data dengan nilai yang sama sudah ada";
  }

  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Sesi tidak valid, silakan login kembali";
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Sesi telah berakhir, silakan login kembali";
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
