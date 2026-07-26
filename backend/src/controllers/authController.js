const User = require("../models/User");
const generateToken = require("../utils/generateToken");

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

    if (!user || !(await user.matchPassword(password))) {
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
