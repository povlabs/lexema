#!/usr/bin/env bash
# Proof that vinext + Cloudflare Workers + D1 works locally.
#
#   cd spike/vinext && pnpm install && pnpm run proof
#
# Seeds a local D1, builds the Worker, starts it under wrangler (workerd),
# and asserts that a server-rendered page and a route handler both return
# real rows. Nothing touches Cloudflare's servers.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
PORT="${PORT:-8788}"
BASE="http://localhost:${PORT}"
LOG="$(mktemp -t vinext-proof)"

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  wait "${SERVER_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "1/5 seed local D1 (miniflare, no network)"
CI=1 pnpm exec wrangler d1 execute lexema_spike --local --file=./db/seed.sql >/dev/null
CI=1 pnpm exec wrangler d1 execute lexema_spike --local \
  --command "SELECT count(*) AS seeded_rows FROM spike_words" --json

step "2/5 build the Worker"
pnpm run build >/dev/null

step "3/5 start the built Worker on the Workers runtime"
# --persist-to must be ABSOLUTE: wrangler resolves it relative to the config
# file, and the generated config lives in dist/server/.
CI=1 pnpm exec wrangler dev \
  --config dist/server/wrangler.json \
  --persist-to "$ROOT/.wrangler/state" \
  --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  curl -sf --max-time 2 "$BASE/api/hello?q=casa" >/dev/null 2>&1 && break
  sleep 1
done

step "4/5 route handler -> D1"
API=$(curl -sf "$BASE/api/hello?q=casa")
echo "$API"
grep -q '"count":2' <<<"$API" || { echo "FAIL: expected 2 rows for casa"; tail -40 "$LOG"; exit 1; }

step "5/5 server-rendered React page -> D1"
HTML=$(curl -sf "$BASE/?q=gatto")
sed -n 's/.*\(<main>.*<\/main>\).*/\1/p' <<<"$HTML"
grep -q 'FAKE SEED DATA - a cat' <<<"$HTML" || { echo "FAIL: row not in server-rendered HTML"; exit 1; }
grep -q 'data-row-id="3"' <<<"$HTML" || { echo "FAIL: expected row id 3"; exit 1; }

# Accents survive the URL -> Worker -> D1 -> HTML trip.
curl -sf --get --data-urlencode "q=perché" "$BASE/api/hello" | grep -q '"count":1' \
  || { echo "FAIL: accented lemma did not round-trip"; exit 1; }

# .bind() really parameterises; this must match nothing.
curl -sf --get --data-urlencode "q=casa' OR '1'='1" "$BASE/api/hello" | grep -q '"count":0' \
  || { echo "FAIL: query was not parameterised"; exit 1; }

# generateMetadata sees the query string.
curl -sf "$BASE/?q=libro" | grep -q '<title>libro — Lexema spike</title>' \
  || { echo "FAIL: generateMetadata did not use the query"; exit 1; }

# Optional: prove the client island hydrates. data-hydrated is "no" in server
# HTML and "yes" only after React runs the effect in a real browser.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ -x "$CHROME" ]]; then
  step "bonus: client component hydration"
  grep -q 'data-hydrated="no"' <<<"$HTML" || { echo "FAIL: expected unhydrated server HTML"; exit 1; }
  "$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 \
    --dump-dom "$BASE/?q=casa" 2>/dev/null | grep -q 'data-hydrated="yes"' \
    || { echo "FAIL: client island did not hydrate"; exit 1; }
  echo 'data-hydrated: no (server) -> yes (after hydration)'
else
  echo "(skipped hydration check: Chrome not found)"
fi

printf '\n\033[32mPASS\033[0m — vinext served real D1 rows from the Workers runtime.\n'
