const express = require("express");

const { getMe, login, register } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

// Deliberately not rate limited. The frontend calls this on every page load to
// validate the stored token, so a limit low enough to stop brute forcing would
// lock a normal user out after a handful of refreshes. It is already protected
// by `protect`, which requires a valid signed token.
router.get("/me", protect, getMe);

module.exports = router;
