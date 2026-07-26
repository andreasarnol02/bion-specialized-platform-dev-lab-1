#!/usr/bin/env bash
# End-to-end verification of the auth and product authorization flow.
# Usage: ./smoke-test.sh [BASE_URL]
#   ./smoke-test.sh
#   ./smoke-test.sh https://toko-arnol-api.onrender.com

set -u

BASE_URL="${1:-http://localhost:5001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tokoarnol.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin12345}"
# PID as well as timestamp: `date +%s` has one-second resolution, so two runs
# started within the same second would collide on the unique email index.
PROBE_EMAIL="smoke-$(date +%s)-$$@test.com"

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

# Every extractor below uses `sed -n ... p` rather than a bare substitution.
# A bare `sed 's/x/y/'` echoes its input unchanged when the pattern does not
# match, so a failed request would yield the whole error JSON instead of an
# empty string -- and a `[ -n "$VALUE" ]` test on that would wrongly pass.
token_from() { sed -nE 's/.*"token":"([^"]+)".*/\1/p'; }
role_from()  { sed -nE 's/.*"role":"([^"]+)".*/\1/p'; }
id_from()    { sed -nE 's/.*"_id":"([a-f0-9]{24})".*/\1/p'; }

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
  "$(echo "$REGISTER_BODY" | role_from)"

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
  "$(echo "$ADMIN_BODY" | role_from)"

echo "6. Admin writes succeed"
CREATED=$(body_of -X POST "$BASE_URL/api/products" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Produk Smoke Test","price":9999,"stock":1,"category":"Uji"}')
PRODUCT_ID=$(echo "$CREATED" | id_from)
check "POST /api/products as admin returns an id" "true" \
  "$([ -n "$PRODUCT_ID" ] && echo true || echo false)"

echo "7. Cleanup"
if [ -n "$PRODUCT_ID" ]; then
  check "DELETE /api/products/:id as admin" "200" \
    "$(status_of -X DELETE "$BASE_URL/api/products/$PRODUCT_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")"
else
  check "DELETE /api/products/:id as admin" "200" "skipped (no product id)"
fi

echo
echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
