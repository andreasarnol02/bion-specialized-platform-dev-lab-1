const bcrypt = require("bcryptjs");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// Compared against when the email is not found, so that path costs the same
// as a real bcrypt check. Without it the not-found branch short-circuits and
// returns in ~1ms while a found account takes ~53ms, which lets an attacker
// enumerate registered emails by response time even though both branches
// return an identical message.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("constant-time-placeholder", 10);

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Nama, email, dan password wajib diisi",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email sudah terdaftar",
      });
    }

    const user = await User.create({ name, email, password, role: "user" });

    res.status(201).json({
      success: true,
      data: {
        user: user.toSafeObject(),
        token: generateToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    // Always run one bcrypt comparison, whether or not the account exists.
    // The result of the dummy comparison is discarded -- it is spent purely
    // to keep both branches the same duration.
    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah",
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        token: generateToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user.toSafeObject(),
    },
  });
};

module.exports = { register, login, getMe };
