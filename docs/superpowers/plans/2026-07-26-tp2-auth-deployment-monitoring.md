# TP2 Auth, Deployment, and Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the TP1 Toko Arnol store with JWT authentication and role-based admin protection, deploy it to Render and Vercel, and instrument the frontend with Google Analytics 4.

**Architecture:** The Express API gains a `User` model and two middlewares — `protect` verifies a Bearer JWT, `requireAdmin` checks the role — applied to the three mutating product routes while reads stay public. The React app gains an `AuthContext` holding a three-state status (`loading`/`authenticated`/`guest`), a `ProtectedRoute` layout route wrapping `/admin/*`, and a single `apiFetch` client that attaches the token and reacts to 401. Both halves deploy to free tiers with configuration driven entirely by environment variables.

**Tech Stack:** Node.js 20, Express 4, Mongoose 8, `bcryptjs`, `jsonwebtoken`, React 18, React Router 7, Vite 6, MongoDB Atlas M0, Render, Vercel, Google Analytics 4.

**Spec:** `docs/superpowers/specs/2026-07-26-tp2-auth-deployment-monitoring-design.md`

## Global Constraints

- **Response envelope:** every endpoint returns `{ success: true, data }` or `{ success: false, message }`. Never deviate — the frontend `apiFetch` unwraps `data` unconditionally.
- **Language:** all user-facing strings, validation messages, and API error messages are in Indonesian. Code identifiers and comments stay in English, matching TP1.
- **Style:** CommonJS (`require`/`module.exports`) in `backend/`, ES modules (`import`/`export`) in `frontend/`. Double-quoted strings. Named exports for utilities, default export for React components.
- **Password hashing:** `bcryptjs` only. Never `bcrypt` — the native addon breaks Render builds.
- **Role escalation:** `POST /api/auth/register` always creates `role: "user"`. No endpoint may accept a role from the request body.
- **Backend port:** `5001` (matches the existing `backend/.env` and `README.md`).
- **Token storage key:** `toko_arnol_token` in `localStorage`. Used verbatim in `client.js` and nowhere else.
- **Existing CSS:** reuse the design tokens in `frontend/src/styles/global.css` (`--brand`, `--ink-soft`, `--line`, `--radius-control`, `--danger`, …). Never hardcode a hex colour that a token already covers.
- **No new test framework.** Verification is curl and browser checks, per the spec.

---

## Task 1: Backend auth foundation — dependencies, User model, token utility

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/models/User.js`
- Create: `backend/src/utils/generateToken.js`
- Modify: `backend/.env`, `backend/.env.example`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `User` Mongoose model. Instance methods: `matchPassword(plainText) -> Promise<boolean>`, `toSafeObject() -> { id, name, email, role }`. Fields: `name`, `email`, `password` (`select: false`), `role` (`"user" | "admin"`).
  - `generateToken(user) -> string` (default export of `utils/generateToken.js`), signing `{ id, role }`.

- [ ] **Step 1: Install the two auth dependencies**

```bash
cd backend
npm install bcryptjs jsonwebtoken
```

Expected: `package.json` `dependencies` now lists `bcryptjs` and `jsonwebtoken`.

- [ ] **Step 2: Add JWT and admin-seed variables to `backend/.env`**

Append to the existing file (keep `PORT`, `MONGODB_URI` as they are; `CLIENT_URL` is renamed in Task 4, leave it alone for now):

```txt
JWT_SECRET=dev-secret-ganti-di-produksi-minimal-32-karakter
JWT_EXPIRES_IN=7d
ADMIN_NAME=Andreas Arnol
ADMIN_EMAIL=admin@tokoarnol.com
ADMIN_PASSWORD=admin12345
```

- [ ] **Step 3: Mirror the same keys into `backend/.env.example`**

Replace the whole file with:

```txt
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/online-store
CLIENT_URLS=http://localhost:5173
JWT_SECRET=generate-dengan-openssl-rand-hex-32
JWT_EXPIRES_IN=7d
ADMIN_NAME=Nama Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ganti-password-ini
```

`.env.example` is committed; `.env` is gitignored. Never put a real secret in the example.

- [ ] **Step 4: Create `backend/src/models/User.js`**

```js
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama wajib diisi"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email wajib diisi"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Format email tidak valid"],
    },
    password: {
      type: String,
      required: [true, "Password wajib diisi"],
      minlength: [6, "Password minimal 6 karakter"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
  };
};

module.exports = mongoose.model("User", userSchema);
```

Three details that matter:
- `select: false` keeps the hash out of every query result unless a caller writes `.select("+password")`. Only the login controller does.
- The `isModified("password")` guard stops an unrelated `save()` — such as promoting a role — from hashing an already-hashed value.
- `toSafeObject()` is the only shape sent to clients. Controllers never serialise a `User` document directly.

- [ ] **Step 5: Create `backend/src/utils/generateToken.js`**

```js
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET belum diatur pada environment variable");
  }

  return jwt.sign({ id: user._id, role: user.role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
```

Failing loudly on a missing secret is deliberate. `jwt.sign` with `undefined` throws anyway, but with an opaque message; this one names the misconfiguration.

- [ ] **Step 6: Verify the model hashes and compares correctly**

Run from `backend/`:

```bash
node -e '
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const generateToken = require("./src/utils/generateToken");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteOne({ email: "probe@test.com" });

  const user = await User.create({
    name: "Probe", email: "probe@test.com", password: "rahasia123",
  });

  const fetched = await User.findOne({ email: "probe@test.com" }).select("+password");
  console.log("hash != plaintext:", fetched.password !== "rahasia123");
  console.log("correct password:", await fetched.matchPassword("rahasia123"));
  console.log("wrong password:", await fetched.matchPassword("salah"));
  console.log("default role:", user.role);
  console.log("safe object:", JSON.stringify(user.toSafeObject()));
  console.log("no password in safe object:", !("password" in user.toSafeObject()));
  console.log("token:", generateToken(user).slice(0, 20) + "...");

  await User.deleteOne({ email: "probe@test.com" });
  await mongoose.disconnect();
})();
'
```

Expected output:

```
hash != plaintext: true
correct password: true
wrong password: false
default role: user
safe object: {"id":"...","name":"Probe","email":"probe@test.com","role":"user"}
no password in safe object: true
token: eyJhbGciOiJIUzI1NiIs...
```

If `wrong password: true` appears, the pre-save hook did not run. If `default role` is empty, the enum default is missing.

MongoDB must be running: `brew services start mongodb-community`.

- [ ] **Step 7: Commit**

```bash
cd "/Users/andreasarnol02/Documents/Academic/University/Semester 3/Platform Development/LAB/TP1"
git add backend/package.json backend/package-lock.json backend/src/models/User.js backend/src/utils/generateToken.js backend/.env.example
git commit -m "feat(auth): add User model with bcrypt hashing and JWT token utility"
```

`backend/.env` is gitignored and must not appear in `git status` as staged. If it does, stop and check `.gitignore`.

---

## Task 2: Auth middleware and JWT error mapping

**Files:**
- Create: `backend/src/middleware/auth.js`
- Modify: `backend/src/middleware/errorHandler.js`

**Interfaces:**
- Consumes: `User` model from Task 1.
- Produces: `{ protect, requireAdmin }` named exports from `middleware/auth.js`. `protect` attaches the full Mongoose `User` document to `req.user`. `requireAdmin` must run after `protect`.

- [ ] **Step 1: Create `backend/src/middleware/auth.js`**

```js
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Tidak ada akses, silakan login terlebih dahulu",
      });
    }

    const token = header.slice("Bearer ".length).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Sesi tidak valid, silakan login kembali",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak, hanya admin yang diizinkan",
    });
  }

  next();
};

module.exports = { protect, requireAdmin };
```

`protect` re-reads the user from the database rather than trusting the `role` inside the token. A token issued before a demotion would otherwise keep working until it expired.

Malformed and expired tokens make `jwt.verify` throw, which `next(error)` hands to the error handler — mapped to 401 in the next step.

- [ ] **Step 2: Map JWT errors to 401 in `backend/src/middleware/errorHandler.js`**

Insert after the existing `error.code === 11000` block, before the `res.status(...)` call:

```js
  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Sesi tidak valid, silakan login kembali";
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Sesi telah berakhir, silakan login kembali";
  }
```

Without this, a tampered token surfaces as a 500 with the raw text `jwt malformed`, which tells an attacker about the stack and tells the frontend nothing actionable.

- [ ] **Step 3: Verify the error mapping in isolation**

Run from `backend/`:

```bash
node -e '
const errorHandler = require("./src/middleware/errorHandler");

const check = (error, label) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { console.log(label, this.statusCode, JSON.stringify(payload)); },
  };
  errorHandler(error, {}, res, () => {});
};

const jwtError = new Error("jwt malformed");
jwtError.name = "JsonWebTokenError";
check(jwtError, "malformed:");

const expiredError = new Error("jwt expired");
expiredError.name = "TokenExpiredError";
check(expiredError, "expired:  ");

check(new Error("Sesuatu meledak"), "generic:  ");
'
```

Expected:

```
malformed: 401 {"success":false,"message":"Sesi tidak valid, silakan login kembali"}
expired:   401 {"success":false,"message":"Sesi telah berakhir, silakan login kembali"}
generic:   500 {"success":false,"message":"Sesuatu meledak"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.js backend/src/middleware/errorHandler.js
git commit -m "feat(auth): add protect and requireAdmin middleware with JWT error mapping"
```

---

## Task 3: Auth endpoints — controller, routes, and mounting

**Files:**
- Create: `backend/src/controllers/authController.js`
- Create: `backend/src/routes/authRoutes.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `User` and `generateToken` from Task 1, `protect` from Task 2.
- Produces: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`. Register and login both return `data: { user: { id, name, email, role }, token }`. `getMe` returns `data: { user }`.

- [ ] **Step 1: Create `backend/src/controllers/authController.js`**

```js
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
```

Two deliberate choices:
- `register` destructures exactly `name`, `email`, `password` and passes `role: "user"` as a literal. A request body containing `"role": "admin"` cannot reach the model.
- `login` returns one message for an unknown email and for a wrong password. Distinct messages would let an attacker discover which addresses have accounts.

- [ ] **Step 2: Create `backend/src/routes/authRoutes.js`**

```js
const express = require("express");

const { getMe, login, register } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

module.exports = router;
```

- [ ] **Step 3: Mount the router in `backend/server.js`**

Add to the imports, after the `productRoutes` require:

```js
const authRoutes = require("./src/routes/authRoutes");
```

Then add above the existing `app.use("/api/products", productRoutes);` line:

```js
app.use("/api/auth", authRoutes);
```

Order matters only in that both must come before `app.use(errorHandler)`. Express runs the error handler last by virtue of registration order.

- [ ] **Step 4: Verify the three endpoints end to end**

Start the server in one terminal (`cd backend && npm run dev`), then in another:

```bash
curl -s -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Uji Coba","email":"uji@test.com","password":"rahasia123","role":"admin"}'
```

Expected: `201`, and `"role":"user"` — **not** `"admin"`. That field in the body must be ignored.

```bash
curl -s -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Uji Coba","email":"uji@test.com","password":"rahasia123"}'
```

Expected: `{"success":false,"message":"Email sudah terdaftar"}`

```bash
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"uji@test.com","password":"salah"}'

curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"tidakada@test.com","password":"rahasia123"}'
```

Expected: **both** return exactly `{"success":false,"message":"Email atau password salah"}`. If they differ, the enumeration guard is broken.

```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"uji@test.com","password":"rahasia123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s http://localhost:5001/api/auth/me -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5001/api/auth/me
curl -s http://localhost:5001/api/auth/me -H "Authorization: Bearer rusak.token.palsu"
```

Expected in order:
1. `{"success":true,"data":{"user":{...,"role":"user"}}}`
2. `{"success":false,"message":"Tidak ada akses, silakan login terlebih dahulu"}`
3. `{"success":false,"message":"Sesi tidak valid, silakan login kembali"}`

Confirm no response anywhere contains the string `password`.

- [ ] **Step 5: Clean up the probe account**

```bash
cd backend && node -e '
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteOne({ email: "uji@test.com" });
  await mongoose.disconnect();
  console.log("probe user removed");
})();
'
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/authController.js backend/src/routes/authRoutes.js backend/server.js
git commit -m "feat(auth): add register, login, and me endpoints"
```

---

## Task 4: Multi-origin CORS allowlist

**Files:**
- Modify: `backend/server.js:13-19`
- Modify: `backend/.env`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CLIENT_URLS` environment variable (comma-separated origins), replacing `CLIENT_URL`.

- [ ] **Step 1: Rename the variable in `backend/.env`**

Replace the `CLIENT_URL=http://localhost:5173` line with:

```txt
CLIENT_URLS=http://localhost:5173
```

- [ ] **Step 2: Replace the CORS block in `backend/server.js`**

Replace lines 13-19 — the `const CLIENT_URL = ...` declaration and the `app.use(cors({ origin: CLIENT_URL }))` call — with:

```js
const allowedOrigins = (process.env.CLIENT_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
    },
  })
);
```

Requests with no `Origin` header are allowed so curl, Postman, and the smoke test keep working. This is not a weakening: browsers always send `Origin` cross-origin, and a non-browser client was never subject to CORS.

The allowlist holds exact strings. Do not add a pattern like `/^https:\/\/[a-z0-9-]+\.vercel\.app$/` — `vercel.app` is a shared public suffix, so any third party could deploy a matching site.

- [ ] **Step 3: Verify allowed and rejected origins**

Restart the server, then:

```bash
curl -s -i http://localhost:5001/api/products \
  -H "Origin: http://localhost:5173" | grep -i "access-control-allow-origin"

curl -s -i http://localhost:5001/api/products \
  -H "Origin: https://situs-jahat.com" | grep -i "access-control-allow-origin"

curl -s http://localhost:5001/api/products | head -c 60
```

Expected:
1. `Access-Control-Allow-Origin: http://localhost:5173`
2. no output — the header is absent, so a browser would block the response
3. `{"success":true,"data":[` — the no-Origin path still works

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat(cors): allow multiple origins via CLIENT_URLS allowlist"
```

---

## Task 5: Guard product mutations and seed the first admin

**Files:**
- Modify: `backend/src/routes/productRoutes.js`
- Create: `backend/src/scripts/seedAdmin.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `protect` and `requireAdmin` from Task 2, `User` from Task 1.
- Produces: `npm run seed:admin` script. `GET` product routes stay public; `POST`, `PUT`, `DELETE` require an admin token.

- [ ] **Step 1: Apply the guards in `backend/src/routes/productRoutes.js`**

Add the middleware import after the controller import:

```js
const { protect, requireAdmin } = require("../middleware/auth");
```

Replace the two route lines with:

```js
router
  .route("/")
  .get(getProducts)
  .post(protect, requireAdmin, createProduct);

router
  .route("/:id")
  .get(getProductById)
  .put(protect, requireAdmin, updateProduct)
  .delete(protect, requireAdmin, deleteProduct);
```

Reads stay public because the storefront must work for logged-out visitors. Only writes are gated.

- [ ] **Step 2: Create `backend/src/scripts/seedAdmin.js`**

```js
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const seedAdmin = async () => {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diatur di environment"
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = "admin";
    await existing.save();
    console.log(`Akun ${existing.email} dipromosikan menjadi admin`);
  } else {
    const admin = await User.create({ name, email, password, role: "admin" });
    console.log(`Admin ${admin.email} berhasil dibuat`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch(async (error) => {
  console.error("Gagal membuat admin:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
```

The promote branch matters: if you already registered that email through the UI, re-running the script upgrades it instead of failing on the unique index. `existing.save()` does not re-hash, because the pre-save guard checks `isModified("password")`.

- [ ] **Step 3: Add the script to `backend/package.json`**

In `"scripts"`, after `"start"`:

```json
    "seed:admin": "node src/scripts/seedAdmin.js"
```

Remember the comma after the preceding line.

- [ ] **Step 4: Run the seed and confirm it is idempotent**

```bash
cd backend
npm run seed:admin
npm run seed:admin
```

Expected: first run prints `Admin admin@tokoarnol.com berhasil dibuat`, second prints `Akun admin@tokoarnol.com dipromosikan menjadi admin`. Neither errors.

- [ ] **Step 5: Verify the guards reject, then allow**

With the server running:

```bash
# No token at all
curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Uji","price":1000}'
```

Expected: `{"success":false,"message":"Tidak ada akses, silakan login terlebih dahulu"}`

```bash
# A normal user's token
curl -s -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Biasa","email":"biasa@test.com","password":"rahasia123"}' > /dev/null

USER_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"biasa@test.com","password":"rahasia123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"name":"Uji","price":1000}'
```

Expected: `{"success":false,"message":"Akses ditolak, hanya admin yang diizinkan"}` — a 403, distinct from the 401 above.

```bash
# The admin's token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tokoarnol.com","password":"admin12345"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Produk Uji","price":1000,"stock":1}'

# Reads must still be public
curl -s http://localhost:5001/api/products | head -c 40
```

Expected: the POST returns `201` with the created product; the GET succeeds with no token.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/productRoutes.js backend/src/scripts/seedAdmin.js backend/package.json
git commit -m "feat(auth): require admin for product mutations, add admin seed script"
```

---

## Task 6: Backend smoke test script

**Files:**
- Create: `backend/smoke-test.sh`

**Interfaces:**
- Consumes: every backend endpoint from Tasks 3 and 5.
- Produces: `./smoke-test.sh [BASE_URL]` — defaults to `http://localhost:5001`. Exits `0` when all seven checks pass, `1` otherwise.

- [ ] **Step 1: Create `backend/smoke-test.sh`**

```bash
#!/usr/bin/env bash
# End-to-end verification of the auth and product authorization flow.
# Usage: ./smoke-test.sh [BASE_URL]
#   ./smoke-test.sh
#   ./smoke-test.sh https://toko-arnol-api.onrender.com

set -u

BASE_URL="${1:-http://localhost:5001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tokoarnol.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin12345}"
PROBE_EMAIL="smoke-$(date +%s)@test.com"

PASS=0
FAIL=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  \033[32mPASS\033[0m  %-52s %s\n' "$label" "$actual"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-52s expected %s, got %s\n' "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body_of()   { curl -s "$@"; }
token_from() { sed -E 's/.*"token":"([^"]+)".*/\1/'; }

echo "Smoke test: $BASE_URL"
echo

echo "1. Public reads"
check "GET /api/products without token" "200" \
  "$(status_of "$BASE_URL/api/products")"

echo "2. Unauthenticated writes are rejected"
check "POST /api/products without token" "401" \
  "$(status_of -X POST "$BASE_URL/api/products" \
      -H 'Content-Type: application/json' -d '{"name":"X","price":1}')"

echo "3. Registration"
REGISTER_BODY=$(body_of -X POST "$BASE_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke\",\"email\":\"$PROBE_EMAIL\",\"password\":\"rahasia123\"}")
check "register returns role user" "user" \
  "$(echo "$REGISTER_BODY" | sed -E 's/.*"role":"([^"]+)".*/\1/')"

echo "4. Non-admin writes are rejected"
USER_TOKEN=$(echo "$REGISTER_BODY" | token_from)
check "POST /api/products as user" "403" \
  "$(status_of -X POST "$BASE_URL/api/products" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $USER_TOKEN" -d '{"name":"X","price":1}')"

echo "5. Admin login"
ADMIN_BODY=$(body_of -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_BODY" | token_from)
check "admin login returns role admin" "admin" \
  "$(echo "$ADMIN_BODY" | sed -E 's/.*"role":"([^"]+)".*/\1/')"

echo "6. Admin writes succeed"
CREATED=$(body_of -X POST "$BASE_URL/api/products" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Produk Smoke Test","price":9999,"stock":1,"category":"Uji"}')
PRODUCT_ID=$(echo "$CREATED" | sed -E 's/.*"_id":"([^"]+)".*/\1/')
check "POST /api/products as admin" "true" \
  "$([ -n "$PRODUCT_ID" ] && echo true || echo false)"

echo "7. Cleanup"
check "DELETE /api/products/:id as admin" "200" \
  "$(status_of -X DELETE "$BASE_URL/api/products/$PRODUCT_ID" \
      -H "Authorization: Bearer $ADMIN_TOKEN")"

echo
echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
```

The probe email is timestamped so repeated runs never collide with the unique index — important when you run this against the deployed API more than once.

- [ ] **Step 2: Make it executable and run it**

```bash
cd backend
chmod +x smoke-test.sh
./smoke-test.sh
```

Expected: seven `PASS` lines and `Passed: 7   Failed: 0`.

If check 4 reports `401` instead of `403`, `requireAdmin` is running before `protect` in the route chain.

- [ ] **Step 3: Commit**

```bash
git add backend/smoke-test.sh
git commit -m "test: add end-to-end smoke test for auth and product authorization"
```

---

## Task 7: Shared API client and auth API module

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/api/auth.js`
- Modify: `frontend/src/api/products.js` (full rewrite on top of the client)

**Interfaces:**
- Consumes: the backend endpoints from Tasks 3 and 5.
- Produces:
  - `apiFetch(path, { method, body, auth }) -> Promise<data>` — unwraps the envelope, throws `Error(message)` on failure.
  - `getStoredToken() -> string | null`, `setStoredToken(token)`, `clearStoredToken()`.
  - `auth.js`: `register({ name, email, password })`, `login({ email, password })`, `getMe()` — the first two resolve to `{ user, token }`, the third to `{ user }`.
  - `products.js` keeps its existing five named exports and signatures unchanged.

- [ ] **Step 1: Create `frontend/src/api/client.js`**

```js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
const TOKEN_KEY = "toko_arnol_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

export const apiFetch = async (path, options = {}) => {
  const { method = "GET", body, auth = false } = options;
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getStoredToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Server mengirim respons yang tidak valid");
  }

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  if (!response.ok) {
    throw new Error(result.message || "Permintaan gagal");
  }

  return result.data;
};
```

The 401 branch dispatches a `window` event rather than calling into React. `client.js` is a plain module with no access to hooks or context, and importing `AuthContext` would create a cycle — the context imports this module to call `/api/auth/me`. A `CustomEvent` lets each side stay unaware of the other.

Note the 401 handling runs *before* the `!response.ok` throw, so the session is cleared even though the caller also sees an exception.

- [ ] **Step 2: Create `frontend/src/api/auth.js`**

```js
import { apiFetch } from "./client";

export const register = async ({ name, email, password }) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });

export const login = async ({ email, password }) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

export const getMe = async () => apiFetch("/api/auth/me", { auth: true });
```

- [ ] **Step 3: Rewrite `frontend/src/api/products.js` on top of the client**

Replace the entire file:

```js
import { apiFetch } from "./client";

const PRODUCT_PATH = "/api/products";

export const getProducts = async () => apiFetch(PRODUCT_PATH);

export const getProductById = async (id) => apiFetch(`${PRODUCT_PATH}/${id}`);

export const createProduct = async (productData) =>
  apiFetch(PRODUCT_PATH, {
    method: "POST",
    body: productData,
    auth: true,
  });

export const updateProduct = async (id, productData) =>
  apiFetch(`${PRODUCT_PATH}/${id}`, {
    method: "PUT",
    body: productData,
    auth: true,
  });

export const deleteProduct = async (id) =>
  apiFetch(`${PRODUCT_PATH}/${id}`, {
    method: "DELETE",
    auth: true,
  });
```

The five exported names and their arguments are unchanged, so `Home.jsx`, `ProductList.jsx`, `ProductDetail.jsx`, `AdminProducts.jsx`, `CreateProduct.jsx`, and `EditProduct.jsx` need no edits.

This also fixes a latent bug: the old file defaulted to port `5000` while `backend/.env` and `README.md` both use `5001`, so a missing `frontend/.env` silently pointed at nothing.

- [ ] **Step 4: Verify reads still work and the token is attached**

Start both servers (`cd backend && npm run dev`, `cd frontend && npm run dev`), open `http://localhost:5173`, and confirm the product grid still renders.

Then in the browser DevTools console:

```js
// No token yet — a write should be rejected by the server.
const { createProduct } = await import("/src/api/products.js");
await createProduct({ name: "Uji", price: 1000 }).catch((e) => e.message);
```

Expected: `"Tidak ada akses, silakan login terlebih dahulu"`.

```js
// Store a token by hand and confirm it reaches the server.
const { login } = await import("/src/api/auth.js");
const { setStoredToken } = await import("/src/api/client.js");
const data = await login({ email: "admin@tokoarnol.com", password: "admin12345" });
setStoredToken(data.token);
localStorage.getItem("toko_arnol_token")?.slice(0, 12);
```

Expected: the key `toko_arnol_token` holds a string starting `eyJhbGciOiJ`.

```js
// Now the same write succeeds.
const { createProduct, deleteProduct } = await import("/src/api/products.js");
const made = await createProduct({ name: "Uji Client", price: 1000, stock: 1 });
await deleteProduct(made._id);
"write allowed with admin token";
```

Expected: no exception. Clear the token afterwards with `localStorage.removeItem("toko_arnol_token")`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/api/auth.js frontend/src/api/products.js
git commit -m "refactor(api): centralize fetch in apiFetch client with bearer token support"
```

---

## Task 8: AuthContext provider

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Consumes: `getMe`, `login`, `register` from Task 7; `getStoredToken`, `setStoredToken`, `clearStoredToken` from Task 7. Also calls `trackEvent` from `../utils/analytics` — created in Task 11, so **Task 11 must be completed before this file will run**. To keep tasks independently testable, add the analytics import in Task 11 rather than here.
- Produces: `useAuth() -> { user, status, isAdmin, login, register, logout }` where `status` is `"loading" | "authenticated" | "guest"`, `user` is `{ id, name, email, role } | null`, and `login`/`register` resolve to the user object.

- [ ] **Step 1: Create `frontend/src/context/AuthContext.jsx`**

```jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../api/client";
import {
  getMe,
  login as loginRequest,
  register as registerRequest,
} from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!getStoredToken()) {
      setStatus("guest");
      return undefined;
    }

    let active = true;

    getMe()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        clearStoredToken();
        setUser(null);
        setStatus("guest");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStatus("guest");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async (details) => {
    const data = await registerRequest(details);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }

  return context;
}
```

Four details:
- `status` starts at `"loading"`, never `"guest"`. Starting at `"guest"` is what makes a refresh on `/admin` bounce to the login page before the token has been read.
- The boot effect calls `getMe()` instead of decoding the token locally. A token can be expired or signed with a rotated secret; only the server knows.
- The `active` flag prevents a state update after unmount, which React StrictMode's double-invoked effects would otherwise trigger in development.
- `useMemo` on the context value stops every consumer re-rendering on each provider render.

- [ ] **Step 2: Wrap the app in `frontend/src/main.jsx`**

Add the import:

```jsx
import { AuthProvider } from "./context/AuthContext";
```

and wrap `<App />`:

```jsx
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

`AuthProvider` sits inside `BrowserRouter` because later tasks give it components that use router hooks, and a component cannot call `useLocation` from outside the router.

- [ ] **Step 3: Verify the three states in the browser console**

With both servers running, open `http://localhost:5173` and run:

```js
localStorage.removeItem("toko_arnol_token");
location.reload();
```

After reload, the app renders normally (no crash). Then:

```js
const { login } = await import("/src/api/auth.js");
const { setStoredToken } = await import("/src/api/client.js");
setStoredToken((await login({ email: "admin@tokoarnol.com", password: "admin12345" })).token);
location.reload();
```

After this reload the boot effect validates the token against `/api/auth/me`. Confirm in the Network tab that a request to `/api/auth/me` fired and returned `200`.

```js
localStorage.setItem("toko_arnol_token", "token.yang.rusak");
location.reload();
```

Confirm `/api/auth/me` returns `401` and that `localStorage.getItem("toko_arnol_token")` is `null` afterwards — the invalid token cleared itself rather than persisting.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/main.jsx
git commit -m "feat(auth): add AuthProvider with loading/authenticated/guest status"
```

---

## Task 9: Login and Register pages with route protection

**Files:**
- Create: `frontend/src/components/ProtectedRoute.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth` from Task 8, existing `Loading` and `ErrorMessage` components.
- Produces: `/login` and `/register` routes; `/admin`, `/admin/new`, `/admin/:id/edit` gated behind `role === "admin"`.

- [ ] **Step 1: Create `frontend/src/components/ProtectedRoute.jsx`**

```jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

import Loading from "./Loading";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ requireAdmin = false }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <Loading />;
  }

  if (status === "guest") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
```

A non-admin who is logged in goes to `/` rather than `/login`. Sending them to login would loop forever — they are already authenticated, so logging in again changes nothing.

Rendering `<Outlet />` makes this a layout route, so one guard covers all three admin routes instead of being repeated three times.

- [ ] **Step 2: Create `frontend/src/pages/Login.jsx`**

```jsx
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
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="section-header">
        <p className="eyebrow">Akun</p>
        <h1>Masuk</h1>
        <p className="lead">
          Masuk untuk mengelola katalog Toko Arnol.
        </p>
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
```

`isSubmitting` is reset only in the `catch`. On success the component navigates away and unmounts, so resetting it there would set state on an unmounted component.

- [ ] **Step 3: Create `frontend/src/pages/Register.jsx`**

```jsx
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
```

The confirm-password and length checks run client-side purely for fast feedback. The server enforces the same 6-character minimum through the Mongoose `minlength` validator, which is the check that actually matters.

- [ ] **Step 4: Wire the routes in `frontend/src/App.jsx`**

Add these imports alongside the existing page imports:

```jsx
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
```

Replace the three flat `/admin` routes with the two public auth routes plus a guarded group:

```jsx
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminProducts />} />
            <Route path="/admin/new" element={<CreateProduct />} />
            <Route path="/admin/:id/edit" element={<EditProduct />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
```

- [ ] **Step 5: Verify route protection in the browser**

With both servers running and `localStorage` cleared:

| Action | Expected |
| --- | --- |
| Visit `/admin` while logged out | Redirected to `/login` |
| Log in as `admin@tokoarnol.com` from that redirect | Lands on `/admin`, not `/` |
| Refresh while on `/admin` | Stays on `/admin` — briefly shows "Memuat..." |
| Press browser Back after the login redirect | Does not bounce between `/login` and `/admin` |
| Register a new account, then visit `/admin` | Redirected to `/`, not `/login` |
| Visit `/login` while already logged in | Redirected to `/` |
| Log in with a wrong password | Shows "Email atau password salah", stays on `/login` |

The refresh case is the important one. If it bounces to `/login`, `ProtectedRoute` is not handling `status === "loading"`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ProtectedRoute.jsx frontend/src/pages/Login.jsx frontend/src/pages/Register.jsx frontend/src/App.jsx
git commit -m "feat(auth): add login and register pages with admin route protection"
```

---

## Task 10: Navbar auth state and styles

**Files:**
- Modify: `frontend/src/components/Navbar.jsx`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes: `useAuth` from Task 8.
- Produces: no new exports. Navbar renders different links per auth status.

- [ ] **Step 1: Rewrite the `nav-links` block in `frontend/src/components/Navbar.jsx`**

Add to the imports:

```jsx
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
```

Add inside the component, before `return`:

```jsx
  const { user, status, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };
```

Replace the contents of `<div className="nav-links">` — keep the Beranda and Produk links exactly as they are, then replace the Admin link with:

```jsx
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Admin
            </NavLink>
          )}

          {status === "authenticated" ? (
            <div className="nav-user">
              <span className="nav-user-name">Halo, {user.name}</span>
              <button className="button ghost" type="button" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          ) : (
            status === "guest" && (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  Masuk
                </NavLink>
                <NavLink to="/register" className="nav-cta">
                  Daftar
                </NavLink>
              </>
            )
          )}
```

While `status === "loading"` neither branch renders, so the navbar shows no auth controls for the fraction of a second before the token is validated. That is deliberate — flashing "Masuk" and then swapping it for the user's name is worse than showing nothing briefly.

Hiding the Admin link from non-admins is a UX decision, not a security one. `requireAdmin` on the server is the control that matters.

The `nav-cta` class already exists in `global.css` — the design system anticipated a primary nav action.

- [ ] **Step 2: Append the new styles to `frontend/src/styles/global.css`**

```css
.nav-user {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-left: 8px;
}

.nav-user-name {
  color: var(--ink-soft);
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
}

.button.ghost {
  background: transparent;
  border-color: var(--line);
  color: var(--ink-soft);
  min-height: 38px;
  padding: 8px 14px;
}

.button.ghost:hover {
  background: var(--paper);
  border-color: var(--ink-faint);
  color: var(--ink);
}

.auth-shell {
  margin: 0 auto;
  max-width: 460px;
  padding: 32px 0 48px;
}

.auth-shell .section-header {
  margin-bottom: 20px;
  text-align: center;
}

.auth-switch {
  color: var(--ink-soft);
  margin-top: 18px;
  text-align: center;
}

.auth-switch a {
  color: var(--brand);
  font-weight: 700;
}

.auth-switch a:hover {
  color: var(--brand-dark);
  text-decoration: underline;
}

@media (max-width: 640px) {
  .nav-user-name {
    display: none;
  }
}
```

Every colour comes from an existing token. The mobile rule drops the greeting rather than the Keluar button, because the button is the actionable element.

- [ ] **Step 3: Verify each navbar state**

| State | Expected links |
| --- | --- |
| Logged out | Beranda, Produk, Masuk, Daftar (Daftar styled as the green CTA) |
| Logged in as `user` | Beranda, Produk, "Halo, «name»", Keluar — **no** Admin link |
| Logged in as `admin` | Beranda, Produk, Admin, "Halo, «name»", Keluar |
| Click Keluar | Returns to `/`, navbar shows Masuk/Daftar, `localStorage` key is gone |
| Narrow the window below 640px | Greeting hides, Keluar stays |

Also confirm that a plain `user` typing `/admin` into the address bar still lands on `/` — hiding the link must not be the only barrier.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Navbar.jsx frontend/src/styles/global.css
git commit -m "feat(auth): show auth state and role-aware links in the navbar"
```

---

## Task 11: Google Analytics 4 instrumentation

**Files:**
- Create: `frontend/src/utils/analytics.js`
- Create: `frontend/src/hooks/useAnalytics.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/pages/ProductDetail.jsx`
- Modify: `frontend/src/pages/CreateProduct.jsx`, `frontend/src/pages/EditProduct.jsx`, `frontend/src/pages/AdminProducts.jsx`
- Modify: `frontend/.env`, `frontend/.env.example`

**Interfaces:**
- Consumes: `useLocation` from React Router.
- Produces: `initAnalytics()`, `trackPageView(path)`, `trackEvent(name, params)` from `utils/analytics.js`; `useAnalytics()` default export from `hooks/useAnalytics.js`.

- [ ] **Step 1: Add the measurement ID to both frontend env files**

`frontend/.env`:

```txt
VITE_API_URL=http://localhost:5001
VITE_GA_MEASUREMENT_ID=
```

`frontend/.env.example`:

```txt
VITE_API_URL=http://localhost:5001
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Leaving the local value empty is intentional: analytics no-op in development, so your dashboard stays clean for the graded screenshots.

- [ ] **Step 2: Create `frontend/src/utils/analytics.js`**

```js
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export const initAnalytics = () => {
  if (initialized || !MEASUREMENT_ID) {
    return;
  }

  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: false });
};

export const trackPageView = (path) => {
  if (!MEASUREMENT_ID || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = (name, params = {}) => {
  if (!MEASUREMENT_ID || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", name, params);
};
```

`send_page_view: false` in the config call is essential. Without it GA sends an automatic pageview on load *and* the hook sends one for the initial route, double-counting every session's landing page.

`gtag` must be a `function` declaration, not an arrow — it relies on `arguments`, which arrows do not have. This is why Google's official snippet uses `function`.

Every helper returns early when `MEASUREMENT_ID` is unset, so the app runs with no GA account configured.

- [ ] **Step 3: Create `frontend/src/hooks/useAnalytics.js`**

```js
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { initAnalytics, trackPageView } from "../utils/analytics";

function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
}

export default useAnalytics;
```

GA4's snippet fires `page_view` once, on document load. React Router changes routes through the History API with no document load, so without this effect a whole session records a single pageview on `/`. A GA report showing all traffic on `/` and nothing else is the signature of a missing SPA pageview hook.

The dependency array lists `location.pathname` and `location.search` rather than `location`, because React Router returns a new location object on every render even when the URL is unchanged.

- [ ] **Step 4: Call the hook in `frontend/src/App.jsx`**

Add the import:

```jsx
import useAnalytics from "./hooks/useAnalytics";
```

and call it as the first line of the component body:

```jsx
function App() {
  useAnalytics();

  return (
```

- [ ] **Step 5: Add auth events to `frontend/src/context/AuthContext.jsx`**

Add the import:

```jsx
import { trackEvent } from "../utils/analytics";
```

Add `trackEvent` calls to the three callbacks, immediately before each `return` / at the end of `logout`:

```jsx
  // inside login, after setStatus("authenticated")
    trackEvent("login", { method: "password" });

  // inside register, after setStatus("authenticated")
    trackEvent("sign_up", { method: "password" });

  // inside logout, after setStatus("guest")
    trackEvent("logout");
```

`login` and `sign_up` are GA4 recommended event names, so they populate built-in reports without custom definitions. No event carries a name, email, or token — GA4's terms forbid personally identifiable information.

- [ ] **Step 6: Add a `view_item` event to `frontend/src/pages/ProductDetail.jsx`**

Add the import:

```jsx
import { trackEvent } from "../utils/analytics";
```

The load effect currently reads (around `ProductDetail.jsx:22-23`):

```jsx
        const data = await getProductById(id);
        setProduct(data);
```

Add the event immediately after `setProduct(data)`, using `data` — **not** `product`:

```jsx
        const data = await getProductById(id);
        setProduct(data);
        trackEvent("view_item", {
          item_id: data._id,
          item_name: data.name,
          item_category: data.category,
          value: data.price,
          currency: "IDR",
        });
```

`product` is the state variable and is still `null` on the render that runs this effect — `setProduct` schedules an update, it does not assign synchronously. Reading `product._id` here would throw `Cannot read properties of null`. The awaited `data` is the value you actually have.

These parameter names are GA4's e-commerce schema, so the event feeds the built-in item reports rather than requiring custom dimensions.

- [ ] **Step 7: Add admin events to the three admin pages**

Add `import { trackEvent } from "../utils/analytics";` to each file, then make these exact edits.

`CreateProduct.jsx:18-19` currently discards the return value. Capture it:

```jsx
      const created = await createProduct(productData);
      trackEvent("admin_product_create", { item_id: created._id });
      navigate("/admin");
```

`EditProduct.jsx:37-38` — `id` comes from `useParams()` on line 10 and is in scope:

```jsx
      await updateProduct(id, productData);
      trackEvent("admin_product_update", { item_id: id });
      navigate("/admin");
```

`AdminProducts.jsx:42` — `handleDelete` receives the whole `product` object, so the id is `product._id`. There is no bare `id` variable in this function:

```jsx
      await deleteProduct(product._id);
      trackEvent("admin_product_delete", { item_id: product._id });
```

Only the product id is sent — never the name or email of the admin who performed the action.

- [ ] **Step 8: Verify with a real measurement ID**

Create a GA4 property at <https://analytics.google.com> — Admin → Create property → add a Web data stream. For local testing set the stream URL to `http://localhost:5173`. Copy the Measurement ID (`G-` followed by ten characters) into `frontend/.env`, then restart Vite. Vite reads env files only at startup.

Open GA4 → Reports → Realtime, then in the app:

| Action | Expected in Realtime |
| --- | --- |
| Load `/` | One `page_view`, `page_path` `/` |
| Click through to `/products` then a product | Two more `page_view` events with distinct paths, plus one `view_item` |
| Register a new account | `sign_up` |
| Log out and back in | `logout`, then `login` |
| Create a product as admin | `admin_product_create` |

If every `page_view` shows `page_path: /`, the hook is not re-firing on navigation. If the landing page counts two `page_view` events, `send_page_view: false` is missing.

Events can take 10–30 seconds to appear in Realtime. To confirm faster, filter the Network tab for `google-analytics.com/g/collect` and check the `en=` query parameter, which carries the event name.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/utils/analytics.js frontend/src/hooks/useAnalytics.js frontend/src/App.jsx frontend/src/context/AuthContext.jsx frontend/src/pages/ProductDetail.jsx frontend/src/pages/CreateProduct.jsx frontend/src/pages/EditProduct.jsx frontend/src/pages/AdminProducts.jsx frontend/.env.example
git commit -m "feat(monitoring): add GA4 pageview tracking and auth/admin events"
```

---

## Task 12: Deployment configuration

**Files:**
- Create: `backend/render.yaml`
- Create: `frontend/vercel.json`
- Modify: `backend/package.json` (add `engines`)
- Modify: `frontend/package.json` (add `engines`)

**Interfaces:**
- Consumes: `CLIENT_URLS` from Task 4, `npm run seed:admin` from Task 5, `VITE_API_URL` and `VITE_GA_MEASUREMENT_ID` from Tasks 7 and 11.
- Produces: deployable configuration. No runtime code changes.

- [ ] **Step 1: Pin the Node version in both `package.json` files**

Add to `backend/package.json`, as a top-level key after `"license"`:

```json
  "engines": {
    "node": ">=20.0.0"
  },
```

Add the identical block to `frontend/package.json` after `"type": "module",`.

Without a pin, Render and Vercel choose a default that changes over time — a build that works today can break months later with no code change.

- [ ] **Step 2: Create `backend/render.yaml`**

```yaml
services:
  - type: web
    name: toko-arnol-api
    runtime: node
    plan: free
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /
    envVars:
      - key: NODE_VERSION
        value: 20
      - key: PORT
        value: 10000
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: CLIENT_URLS
        sync: false
      - key: ADMIN_NAME
        sync: false
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
```

Three things this encodes:
- `sync: false` marks a secret Render will prompt you for rather than read from the file. Never commit a real connection string or password.
- `generateValue: true` makes Render mint a strong random `JWT_SECRET` — better than one you invent, and it never appears in the repository.
- `startCommand` is `npm start`, which TP1 already defines as `node server.js`. Never `npm run dev` in production — `nodemon` is a devDependency and restarts on file changes, which is meaningless on a read-only deploy.

`server.js` already reads `process.env.PORT`, so the platform's assigned port is honoured with no code change.

- [ ] **Step 3: Create `frontend/vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

The rewrite is not optional. Vercel serves `dist/` as static files, so requesting `/products/abc123` directly makes it look for a file at that path and return 404 *before React loads*. Clicking a link works, because React Router handles that in the browser; refreshing or opening a shared link does not. The rewrite tells Vercel to serve `index.html` for every path and let the client router decide.

- [ ] **Step 4: Set up MongoDB Atlas**

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. Database Access → Add New Database User → note the username and password.
3. Network Access → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`).
4. Connect → Drivers → copy the connection string, replace `<password>`, and append the database name:
   `mongodb+srv://user:pass@cluster.mongodb.net/online-store?retryWrites=true&w=majority`

`0.0.0.0/0` is required because Render's free tier gives no static outbound IP, so there is no address to allowlist. The connection stays protected by SRV credentials and TLS. Say exactly this in your documentation rather than leaving it looking careless.

- [ ] **Step 5: Push to GitHub**

Both platforms deploy from a Git remote.

```bash
git remote -v
```

If there is no remote, create a repository on GitHub and add it:

```bash
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Confirm `backend/.env` and `frontend/.env` are **not** in the pushed tree:

```bash
git ls-files | grep -E "\.env$" || echo "no .env files tracked — correct"
```

Expected: `no .env files tracked — correct`. If a `.env` appears, remove it with `git rm --cached` and rotate every secret it contained — pushed secrets are compromised even after deletion, because the commit history retains them.

- [ ] **Step 6: Deploy the backend to Render**

1. <https://dashboard.render.com> → New → Web Service → connect the repository.
2. Render detects `backend/render.yaml`. Set **Root Directory** to `backend` if it is not already.
3. Fill the prompted secrets: `MONGODB_URI` (Atlas string), `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Set `CLIENT_URLS` to `http://localhost:5173` for now — the Vercel URL does not exist yet.
5. Deploy, then open the service URL. Expected: `{"success":true,"message":"API Toko Arnol berjalan"}`.

Record the URL, of the form `https://toko-arnol-api.onrender.com`.

- [ ] **Step 7: Seed the admin on the deployed database**

Render dashboard → your service → **Shell** tab:

```bash
npm run seed:admin
```

Expected: `Admin «your-email» berhasil dibuat`.

The free plan's shell is available while the service is running. If it has slept, open the service URL first to wake it.

- [ ] **Step 8: Deploy the frontend to Vercel**

1. <https://vercel.com/new> → import the same repository.
2. Set **Root Directory** to `frontend`.
3. Environment Variables:
   - `VITE_API_URL` = your Render URL, with **no trailing slash**
   - `VITE_GA_MEASUREMENT_ID` = your `G-` id
4. Deploy, and record the URL, of the form `https://toko-arnol.vercel.app`.

A trailing slash on `VITE_API_URL` produces request paths like `https://api.onrender.com//api/products`, which 404. `apiFetch` concatenates without normalising.

- [ ] **Step 9: Close the loop — put the Vercel URL into Render**

Render → Environment → edit `CLIENT_URLS`:

```txt
https://toko-arnol.vercel.app,http://localhost:5173
```

Save. Render redeploys automatically.

**This is the step people miss.** Its symptom is a CORS error in the browser console while the API answers curl perfectly — which sends people off debugging the frontend for an hour. The frontend is fine; the backend simply does not recognise the origin.

- [ ] **Step 10: Add the GA4 production data stream**

GA4 → Admin → Data Streams → your web stream → change the stream URL to your Vercel domain, or add a second stream for it. A stream configured only for `localhost` will not record production traffic.

- [ ] **Step 11: Verify the deployment end to end**

```bash
cd backend
ADMIN_EMAIL=your-admin@email.com ADMIN_PASSWORD=your-password \
  ./smoke-test.sh https://toko-arnol-api.onrender.com
```

Expected: `Passed: 7   Failed: 0`. The first request may take ~50 seconds while the free instance wakes.

Then in a browser, on the Vercel URL:

| Check | Expected |
| --- | --- |
| Storefront loads with products | Data arrives from the Render API |
| Open a product, then refresh the page | Still on the product page, no 404 — proves the SPA rewrite |
| `/admin` while logged out | Redirects to `/login` |
| Log in as the seeded admin | Reaches `/admin`, can create a product |
| DevTools → Network → no CORS errors | `CLIENT_URLS` is correct |
| GA4 Realtime | Your visit appears |

- [ ] **Step 12: Commit**

```bash
git add backend/render.yaml frontend/vercel.json backend/package.json frontend/package.json
git commit -m "chore(deploy): add Render and Vercel configuration with pinned Node version"
git push
```

---

## Task 13: Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/TP2_Dokumentasi.md`

**Interfaces:**
- Consumes: the deployment URLs from Task 12.
- Produces: submission-ready documentation.

- [ ] **Step 1: Update `README.md`**

Make these edits:

1. **Intro** — change "Tugas Personal Lab ke-1 (TP1) Week 6" to note it now covers TP1 and TP2, and add a line listing the two live URLs.

2. **Halaman → Admin table** — replace the closing note (`README.md:30`, "Catatan: pada aplikasi produksi, route admin seharusnya dilindungi autentikasi. Autentikasi berada di luar cakupan tugas ini…") with:

```md
Route admin dilindungi autentikasi JWT dan hanya bisa diakses oleh akun dengan role `admin`.
```

That sentence is now false and must not survive — it describes TP1's state.

3. **Add an Akun section** after the Admin table:

```md
### Akun

| Route | Halaman | Keterangan |
| --- | --- | --- |
| `/login` | Masuk | Login dengan email dan password |
| `/register` | Daftar | Membuat akun baru dengan role `user` |

Registrasi selalu membuat akun dengan role `user`. Akun admin pertama dibuat lewat
`npm run seed:admin`, bukan lewat halaman registrasi.
```

4. **API section** — add the auth endpoints and mark which product endpoints need admin:

```md
| Method | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Publik | Daftar akun baru |
| POST | `/api/auth/login` | Publik | Masuk, mengembalikan token JWT |
| GET | `/api/auth/me` | Token | Data akun yang sedang masuk |
| GET | `/api/products` | Publik | Mengambil semua produk |
| GET | `/api/products/:id` | Publik | Mengambil satu produk |
| POST | `/api/products` | Admin | Menambah produk baru |
| PUT | `/api/products/:id` | Admin | Mengubah produk |
| DELETE | `/api/products/:id` | Admin | Menghapus produk |

Endpoint bertanda Admin memerlukan header `Authorization: Bearer <token>` dari akun
dengan role `admin`.
```

5. **Cara Menjalankan → step 2** — replace both `.env` blocks with the full current set (`CLIENT_URLS` not `CLIENT_URL`, plus `JWT_*`, `ADMIN_*`, `VITE_GA_MEASUREMENT_ID`).

6. **Add a seed step** between "Jalankan backend" and "Jalankan frontend":

````md
### 4. Buat akun admin pertama

```bash
cd backend
npm run seed:admin
```
````

Renumber the following steps.

7. **Struktur Project** — add the new files: `context/`, `hooks/`, `api/client.js`, `api/auth.js`, `pages/Login.jsx`, `pages/Register.jsx`, `components/ProtectedRoute.jsx`, `utils/analytics.js`, `vercel.json`, and on the backend `models/User.js`, `middleware/auth.js`, `controllers/authController.js`, `routes/authRoutes.js`, `utils/generateToken.js`, `scripts/seedAdmin.js`, `smoke-test.sh`, `render.yaml`.

8. **Fix the port inconsistency** — `README.md:34` says base URL `http://localhost:5001` while the old `.env.example` said `PORT=5000`. Task 1 already set the example to `5001`; confirm every mention in the README now reads `5001`.

- [ ] **Step 2: Create `docs/TP2_Dokumentasi.md`**

Structure it to mirror the assignment's `Keluaran yang diharapkan` so a grader can tick each item:

```md
# Dokumentasi TP2 — Toko Arnol

Nama: «isi nama»
NIM: «isi NIM»
Mata Kuliah: Specialized Platform Development

## 1. Link Deployment

| Bagian | Link |
| --- | --- |
| Frontend (Vercel) | «isi URL» |
| Backend (Render) | «isi URL» |
| Repository | «isi URL» |

Akun demo untuk penilaian:

| Role | Email | Password |
| --- | --- | --- |
| Admin | «isi» | «isi» |

## 2. Fitur yang Ditambahkan

### 2.1 Autentikasi JWT (LO3)
[Penjelasan: model User, hashing bcrypt, token disimpan di localStorage,
role user vs admin, proteksi route di frontend dan backend]

> «SCREENSHOT: halaman Register»
> «SCREENSHOT: halaman Login»
> «SCREENSHOT: DevTools → Application → Local Storage, memperlihatkan key toko_arnol_token»
> «SCREENSHOT: percobaan akses /admin tanpa login → diarahkan ke /login»
> «SCREENSHOT: navbar setelah login sebagai admin»

### 2.2 Deployment (LO4)
[Penjelasan: Render untuk backend, Vercel untuk frontend, Atlas untuk database,
konfigurasi environment variable, SPA rewrite, allowlist CORS]

> «SCREENSHOT: dashboard Render, service running»
> «SCREENSHOT: dashboard Vercel, deployment ready»
> «SCREENSHOT: Atlas cluster + collection users dan products»
> «SCREENSHOT: aplikasi terbuka di URL publik»
> «SCREENSHOT: output ./smoke-test.sh terhadap URL Render — 7 PASS»

### 2.3 Monitoring (LO4)
[Penjelasan: GA4, pageview manual untuk SPA, event yang dikirim]

> «SCREENSHOT: GA4 Realtime saat aplikasi dibuka»
> «SCREENSHOT: GA4 laporan Events memperlihatkan login / sign_up / view_item»

## 3. Cara Menjalankan Secara Lokal
[Salin dari README.md]

## 4. Catatan Keamanan

- Password di-hash dengan bcrypt, tidak pernah disimpan dalam bentuk asli.
- Field password memakai `select: false` sehingga tidak pernah ikut terkirim
  dalam respons API.
- Login memberikan pesan error yang sama untuk email tidak dikenal maupun
  password salah, agar penyerang tidak bisa menebak email mana yang terdaftar.
- Registrasi selalu membuat role `user`; role tidak bisa dikirim lewat request body.
- Proteksi route di frontend hanya untuk kenyamanan pengguna. Kontrol yang
  sebenarnya ada di middleware `protect` dan `requireAdmin` pada backend.
- Token disimpan di `localStorage` sesuai ketentuan tugas. Alternatif yang lebih
  aman adalah cookie `httpOnly`, karena isinya tidak bisa dibaca JavaScript
  sehingga lebih tahan terhadap serangan XSS.

## 5. Kendala dan Solusi

| Kendala | Solusi |
| --- | --- |
| Render free tier tidur setelah ~15 menit tidak aktif | Permintaan pertama butuh ~50 detik; dibuka lebih dulu sebelum demo |
| Atlas menolak koneksi dari Render | Network Access diatur ke 0.0.0.0/0 karena Render free tidak punya IP statis |
| Refresh di /admin sempat 404 di Vercel | Ditambahkan SPA rewrite pada vercel.json |
| Error CORS setelah deploy | CLIENT_URLS di Render diisi dengan URL Vercel yang sebenarnya |
```

Replace every `«...»` before submitting. Then paste into Word with the screenshots in place, matching the TP1 document's format.

- [ ] **Step 3: Verify the documentation matches reality**

Walk the README's run instructions on a clean clone into a temporary directory:

```bash
git clone <your-repo-url> /tmp/tp2-check && cd /tmp/tp2-check
```

Follow the README exactly — install, create both `.env` files from the examples, seed, run. If any step is missing or wrong, fix the README, not your local setup. A grader will have exactly this experience.

Confirm every `«placeholder»` in `docs/TP2_Dokumentasi.md` is filled and every screenshot slot has an image before submitting.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/TP2_Dokumentasi.md
git commit -m "docs: document TP2 auth, deployment, and monitoring"
git push
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| User model, `select: false`, `toSafeObject` | 1 |
| `generateToken` | 1 |
| `protect`, `requireAdmin` | 2 |
| JWT error mapping to 401 | 2 |
| Register / login / me contract | 3 |
| Generic login error, no role escalation | 3 |
| CORS allowlist, `CLIENT_URLS` | 4 |
| Product mutation guards | 5 |
| Seed script | 5 |
| Smoke test, seven checks | 6 |
| `apiFetch`, one API client | 7 |
| 401 → `auth:unauthorized` event | 7 |
| Three-state `AuthContext`, boot validation | 8 |
| `ProtectedRoute`, redirect-back | 9 |
| Login and Register pages | 9 |
| Navbar states | 10 |
| GA4 loader, SPA pageviews, events | 11 |
| `render.yaml`, `vercel.json`, env table, ordering | 12 |
| README and TP2 documentation | 13 |

No spec requirement is unassigned.

**Known cross-task dependency:** Task 8 creates `AuthContext.jsx` without the analytics import; Task 11 adds it. Task 8 is therefore runnable on its own, and Task 11 completes the wiring. Do not add `trackEvent` to `AuthContext.jsx` during Task 8 — `utils/analytics.js` does not exist yet and the import would break the build.

**Naming consistency:** `toko_arnol_token`, `CLIENT_URLS`, `apiFetch`, `trackEvent`, `trackPageView`, `initAnalytics`, `toSafeObject`, `matchPassword`, `protect`, `requireAdmin`, and `auth:unauthorized` are each spelled identically everywhere they appear.
