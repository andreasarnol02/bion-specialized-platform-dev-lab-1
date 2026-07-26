const rateLimit = require("express-rate-limit");

const tooManyRequests = (message) => ({
  success: false,
  message,
});

// `skipSuccessfulRequests` means successful logins are not *counted* toward
// the limit -- it does not mean they bypass it. Once ten failures have
// accumulated for an IP, every further request from that IP is refused for
// the rest of the window, correct password included.
//
// The tradeoff that follows: visitors sharing one public IP (campus NAT,
// office) share one budget, so an attacker behind the same NAT can lock out
// legitimate users. Keying on IP alone is still the right call here, because
// keying on the submitted email instead would let an attacker rotate emails
// and never trip the limit at all. Denial of service is the lesser risk.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests(
    "Terlalu banyak percobaan login yang gagal, coba lagi dalam 15 menit"
  ),
});

// Registration counts every request, successful or not, because the abuse
// case here is mass account creation rather than password guessing. The
// ceiling is set well above what a real person needs but far below what
// automated signup abuse requires, and it leaves room for repeated runs of
// smoke-test.sh, which registers a fresh probe account each time.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests(
    "Terlalu banyak pendaftaran dari alamat ini, coba lagi dalam 1 jam"
  ),
});

module.exports = { loginLimiter, registerLimiter };
