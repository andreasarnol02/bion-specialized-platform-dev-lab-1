# TP2 — Authentication, Deployment, and Monitoring

Design for Tugas Personal Lab ke-2 (Week 8), continuing the Toko Arnol online store built for TP1.

## Goal

Extend the existing TP1 application with three capabilities required by the assignment:

| Bobot | Requirement |
| --- | --- |
| LO3, 35% | JWT authentication — Login and Register pages, backend verification, token stored in `localStorage` |
| LO4, 30% | Deployment — backend on Render, frontend on Vercel, frontend consuming the deployed API |
| LO4, 35% | Monitoring — Google Analytics 4 integrated into the frontend |

TP1 shipped an open `/admin` area and its README acknowledged the gap: *"pada aplikasi produksi, route admin seharusnya dilindungi autentikasi."* TP2 closes it.

## Scope

In scope: user registration and login, role-based authorization, route protection on both client and server, GA4 instrumentation, deployment configuration and instructions, updated documentation.

Out of scope: password reset, email verification, refresh tokens, shopping cart, checkout, orders, payments, rate limiting. These are not required by the assignment and are deliberately excluded.

## Decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Authorization model | Roles: `user` and `admin` | Public browsing stays open; only admins mutate products. Demonstrates authorization on top of authentication. |
| Token storage | `localStorage` | Mandated by the assignment. Tradeoff versus httpOnly cookies is documented rather than silently accepted. |
| Password hashing | `bcryptjs` | Pure JavaScript. `bcrypt` is a native addon that compiles at install time and is a common cause of Render build failures. |
| Monitoring | Google Analytics 4 | Free with no session cap, unlike LogRocket's 1,000/month. Sufficient for the required dashboard evidence. |
| Hosting | Render (backend) + Vercel (frontend) + MongoDB Atlas M0 | All free tiers. Heroku no longer offers a free tier. |
| Custom domain | None | The Vercel-generated URL is stable and removes DNS from the critical path. |
| First admin | Seed script | Repeatable, survives a database reset, and produces clean evidence for the documentation. |

### Why registration cannot grant admin

`POST /api/auth/register` always creates `role: "user"`, ignoring any `role` in the request body. The deployment is publicly reachable, so a self-service admin endpoint would let anyone delete the catalogue. The first admin is created out-of-band by a seed script that reads credentials from environment variables.

### Why CORS is not the security boundary

Because the token lives in `localStorage` and travels in an `Authorization` header, a malicious origin cannot read it — `localStorage` is partitioned by origin. CORS here is a hygiene control. The actual boundary is `protect` and `requireAdmin` verifying the JWT signature server-side on every mutating request. Client-side route protection is a user-experience affordance only; removing it would not grant access to anything.

The allowlist contains exact origin strings. A pattern such as `/^https:\/\/[a-z0-9-]+\.vercel\.app$/` is rejected because `vercel.app` is a shared public suffix — any third party can deploy a site that matches it.

## Architecture

```
Browser (Vercel)                       API (Render)                 Atlas
─────────────────                      ─────────────                ─────
AuthContext                            POST /api/auth/register  ──┐
  ├─ localStorage: toko_arnol_token    POST /api/auth/login     ──┼─▶ users
  ├─ boot: GET /api/auth/me            GET  /api/auth/me  [protect]┘
  └─ status: loading|authenticated|guest
                                       GET    /api/products      ──┐  public
ProtectedRoute ─▶ /admin/*             POST   /api/products      ──┤  protect
                                       PUT    /api/products/:id  ──┼─ + requireAdmin
GA4 ─▶ page_view on route change       DELETE /api/products/:id  ──┘
```

## Backend

### New files

| File | Responsibility |
| --- | --- |
| `src/models/User.js` | Schema, bcrypt pre-save hook, `matchPassword` method |
| `src/middleware/auth.js` | `protect` — verify Bearer token, attach `req.user`; `requireAdmin` — check role |
| `src/controllers/authController.js` | `register`, `login`, `getMe` |
| `src/routes/authRoutes.js` | Mounts the three auth endpoints |
| `src/utils/generateToken.js` | Signs `{ id, role }` with `JWT_SECRET` |
| `src/scripts/seedAdmin.js` | Creates or promotes the first admin from env vars |
| `smoke-test.sh` | End-to-end curl verification of the auth flow |

### Modified files

| File | Change |
| --- | --- |
| `server.js` | CORS allowlist function; mount `/api/auth` |
| `src/routes/productRoutes.js` | `protect` + `requireAdmin` on POST, PUT, DELETE |
| `src/middleware/errorHandler.js` | Map `JsonWebTokenError` and `TokenExpiredError` to 401 |
| `package.json` | Add `bcryptjs`, `jsonwebtoken`; add `seed:admin` script |
| `.env.example` | Add `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_*`; rename `CLIENT_URL` to `CLIENT_URLS` |

### User model

| Field | Type | Rules |
| --- | --- | --- |
| `name` | String | Required, trimmed |
| `email` | String | Required, unique, lowercased, trimmed, format-validated |
| `password` | String | Required, minimum 6 characters, `select: false`, bcrypt-hashed on save |
| `role` | String | Enum `user` \| `admin`, default `user` |

`select: false` means Mongoose omits the hash from every query unless a caller explicitly opts in with `.select("+password")`. Only the login controller does. No other code path can leak the hash by accident.

The pre-save hook re-hashes only when `password` is modified, so unrelated updates do not double-hash an existing hash.

### API contract

All responses use the existing `{ success, data }` / `{ success, message }` envelope.

| Method | Endpoint | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | — | `{ name, email, password }` | `201 { user, token }` |
| POST | `/api/auth/login` | — | `{ email, password }` | `200 { user, token }` |
| GET | `/api/auth/me` | Bearer | — | `200 { user }` |

`user` is `{ id, name, email, role }`. The password hash never appears in a response.

### Error responses

| Condition | Status | Message |
| --- | --- | --- |
| Missing required field | 400 | Field-specific, from Mongoose validation |
| Email already registered | 400 | `Email sudah terdaftar` |
| Unknown email **or** wrong password | 401 | `Email atau password salah` |
| No or malformed `Authorization` header | 401 | `Tidak ada akses, silakan login terlebih dahulu` |
| Invalid or expired token | 401 | `Sesi tidak valid, silakan login kembali` |
| Authenticated but `role !== "admin"` | 403 | `Akses ditolak, hanya admin yang diizinkan` |

Unknown email and wrong password return an identical response. Distinct messages would let an attacker enumerate which addresses have accounts.

401 and 403 are deliberately distinct: 401 means *not authenticated* and the client should redirect to login; 403 means *authenticated but not permitted* and redirecting to login would loop forever.

### CORS

```js
// CLIENT_URLS=https://toko-arnol.vercel.app,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_URLS || "")
  .split(",").map((value) => value.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);            // curl, Postman, server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
  },
}));
```

Requests with no `Origin` header are allowed so that curl and the smoke test keep working. This is not a weakening: browsers always send `Origin` on cross-origin requests, and a non-browser client was never subject to CORS in the first place.

## Frontend

### New files

| File | Responsibility |
| --- | --- |
| `src/context/AuthContext.jsx` | `AuthProvider` and `useAuth`; owns token, user, and status |
| `src/components/ProtectedRoute.jsx` | Layout route guard; `requireAdmin` prop |
| `src/pages/Login.jsx` | Login form; redirects back to the intended page |
| `src/pages/Register.jsx` | Registration form with confirm-password |
| `src/api/client.js` | Shared `apiFetch` — base URL, Bearer header, envelope unwrap, 401 handling |
| `src/api/auth.js` | `register`, `login`, `getMe` |
| `src/utils/analytics.js` | GA4 loader and event helpers |
| `src/hooks/useAnalytics.js` | Fires `page_view` on route change |

### Modified files

| File | Change |
| --- | --- |
| `src/main.jsx` | Wrap `<App />` in `<AuthProvider>` inside the router |
| `src/App.jsx` | Add `/login` and `/register`; wrap admin routes; call `useAnalytics()` |
| `src/components/Navbar.jsx` | Conditional links by auth status and role |
| `src/api/products.js` | Rewritten on top of `apiFetch`; mutations pass `auth: true` |
| `src/styles/global.css` | Auth form and navbar-user styles |
| `.env.example` | Add `VITE_GA_MEASUREMENT_ID` |

### Auth state is three states, not a boolean

```
status: "loading" | "authenticated" | "guest"
```

On mount the provider reads the token from `localStorage` and calls `GET /api/auth/me` to validate it, holding `status = "loading"` until the call settles.

A boolean `isLoggedIn` starting at `false` causes a well-known bug: refreshing on `/admin` bounces to `/login` because `ProtectedRoute` reads the initial `false` before the token has been read. `ProtectedRoute` therefore renders `<Loading />` while `status === "loading"` and only redirects on `"guest"`.

Validating against the server rather than decoding the token client-side matters because a token can be expired or signed with a rotated secret. Only the server knows.

### Route table

| Route | Access |
| --- | --- |
| `/`, `/products`, `/products/:id` | Public |
| `/login`, `/register` | Public; redirect to `/` if already authenticated |
| `/admin`, `/admin/new`, `/admin/:id/edit` | `role === "admin"` |

```jsx
<Route element={<ProtectedRoute requireAdmin />}>
  <Route path="/admin" element={<AdminProducts />} />
  <Route path="/admin/new" element={<CreateProduct />} />
  <Route path="/admin/:id/edit" element={<EditProduct />} />
</Route>
```

`ProtectedRoute` is a layout route rendering `<Outlet />`, so the three admin routes share one guard rather than repeating it.

### Redirect back after login

`ProtectedRoute` redirects with `<Navigate to="/login" state={{ from: location }} replace />`. `Login` reads `location.state?.from?.pathname` and returns the user there, defaulting to `/`. Without this, a user deep-linking to `/admin/new` lands on `/` after login and has to navigate again.

`replace` keeps the guarded URL out of history, so the browser Back button does not bounce between the guard and the login page.

### Navbar states

| Status | Links |
| --- | --- |
| `guest` | Beranda, Produk, Masuk, Daftar |
| `authenticated`, `role: user` | Beranda, Produk, greeting, Keluar |
| `authenticated`, `role: admin` | Beranda, Produk, Admin, greeting, Keluar |

The Admin link is hidden from non-admins because showing a link that returns 403 is a poor experience. Hiding it is not a security measure — the server check is.

### One API client, not three

`src/api/client.js` owns every concern shared by product and auth calls: the base URL, JSON headers, unwrapping the `{ success, data }` envelope, raising `result.message` as an `Error`, optionally attaching `Authorization: Bearer`, and reacting to 401.

```js
apiFetch(path, { method, body, auth })
```

`products.js` and `auth.js` become thin wrappers. TP1 duplicated `parseResponse` and header construction across five functions in `products.js`; adding auth would have duplicated them again in `auth.js`. Centralising means the 401 rule is written once and cannot drift between modules.

### Handling 401 from the API layer

On a 401 `apiFetch` clears the stored token and dispatches an `auth:unauthorized` event on `window`. `AuthContext` subscribes and resets to `guest`.

The event indirection exists because `apiFetch` is a plain module, not a React component — it cannot call a hook or reach into context. A `CustomEvent` lets the non-React layer notify the React layer without either importing the other, avoiding a circular dependency between `client.js` and `AuthContext.jsx`.

Without this, an expired token leaves the navbar greeting the user and showing the Admin link while every write fails — the interface asserts a state that no longer exists.

## Monitoring

`VITE_GA_MEASUREMENT_ID` is read at runtime and `gtag.js` is injected dynamically. When the variable is unset — local development — every helper becomes a no-op, so development traffic never pollutes the dashboard and the app runs with no GA account configured.

The ID is not hardcoded in `index.html`, because Vite does not substitute environment variables into static HTML without an extra plugin.

### SPA page views

```js
const location = useLocation();
useEffect(() => {
  trackPageView(location.pathname + location.search);
}, [location]);
```

GA4's snippet fires `page_view` once, on initial document load. React Router changes routes through the History API with no document load, so navigation produces no further pageviews unless they are sent manually. A GA report showing all traffic on `/` and nothing else is the signature of this bug.

### Events

| Event | Fired when |
| --- | --- |
| `page_view` | Any route change |
| `sign_up` | Registration succeeds |
| `login` | Login succeeds |
| `logout` | User logs out |
| `view_item` | Product detail page loads |
| `admin_product_create` | Product created |
| `admin_product_update` | Product updated |
| `admin_product_delete` | Product deleted |

`sign_up`, `login`, and `view_item` are GA4 recommended event names, so they populate built-in reports rather than requiring custom definitions. No event carries an email, name, or token — GA4's terms prohibit personally identifiable information, and the `admin_*` events send only the product id.

## Deployment

### New files

`backend/render.yaml` — Render blueprint pinning the Node version, build, and start commands.

`frontend/vercel.json` — SPA rewrite:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Vercel serves `dist/` as static files. Without the rewrite, requesting `/products/abc123` directly makes Vercel look for a file at that path and return 404 before React loads. Navigation by link works, refresh and shared links do not.

### Environment variables

| Where | Key | Value |
| --- | --- | --- |
| Render | `MONGODB_URI` | Atlas SRV connection string |
| Render | `JWT_SECRET` | 64 hex characters from `openssl rand -hex 32` |
| Render | `JWT_EXPIRES_IN` | `7d` |
| Render | `CLIENT_URLS` | `https://<project>.vercel.app,http://localhost:5173` |
| Render | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed script input |
| Vercel | `VITE_API_URL` | `https://<service>.onrender.com` |
| Vercel | `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` |

Vite inlines `VITE_*` variables at build time, so changing one on Vercel requires a redeploy, not just a restart.

### Ordering

The two services reference each other, so the sequence matters:

1. Create the Atlas cluster; set Network Access to `0.0.0.0/0`.
2. Deploy the backend to Render with a placeholder `CLIENT_URLS`.
3. Deploy the frontend to Vercel with `VITE_API_URL` pointing at the Render URL.
4. Copy the real Vercel URL into Render's `CLIENT_URLS`; Render redeploys automatically.
5. Run the seed script from Render's shell to create the admin.
6. Run `smoke-test.sh` against the deployed API.

Step 4 is the one most often missed, and its symptom — a CORS error in the browser console while the API answers curl correctly — misleads people into debugging the frontend.

### Known constraints

Atlas Network Access must be `0.0.0.0/0` because Render's free tier provides no static outbound IP. The connection remains protected by SRV credentials and TLS.

Render's free web service sleeps after roughly 15 minutes of inactivity; the next request takes around 50 seconds. This affects demonstrations and screenshots and is noted in the documentation.

## Verification

The project has no test framework and the assignment does not require one, so rather than introduce Jest, verification is `backend/smoke-test.sh` — a curl script taking a base URL and exercising:

1. `GET /api/products` succeeds without a token.
2. `POST /api/products` without a token returns 401.
3. Registering returns 201 and a token.
4. `POST /api/products` with that user token returns 403.
5. Logging in as the seeded admin returns a token.
6. `POST /api/products` with the admin token returns 201.
7. `DELETE` of that product with the admin token returns 200.

The same script validates local development and the deployed API, and its output is evidence for the documentation.

Manual checks not expressible in curl: refreshing on `/admin` stays on `/admin`; logging out clears the navbar; GA4 Realtime registers a route change.

## Documentation

`README.md` is updated with the auth endpoints, the new environment variables, the seed step, and the deployment links.

`docs/TP2_Dokumentasi.md` is written to match the assignment's required deliverables — run instructions, deployment links, and marked slots for screenshots — so it can be pasted into Word alongside the TP1 document.
