#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$SCRIPT_DIR/backend.log"
FRONTEND_LOG="$SCRIPT_DIR/frontend.log"
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[SRE]${NC} $*"; }
warn()    { echo -e "${YELLOW}[SRE]${NC} $*"; }
success() { echo -e "${GREEN}[SRE] ✓${NC} $*"; }
err()     { echo -e "${RED}[SRE] ✗${NC} $*"; }

# Kill a PID only if its command line contains our project path — never touches
# unrelated processes even if they happen to use the same port or binary name.
safe_kill() {
  local pid=$1 label=$2
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    return 0  # already gone
  fi
  local cmd
  cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
  if echo "$cmd" | grep -q "$SCRIPT_DIR"; then
    warn "Stopping $label (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    # give it 2s to exit gracefully before forcing
    for _ in $(seq 1 4); do
      sleep 0.5
      kill -0 "$pid" 2>/dev/null || return 0
    done
    kill -9 "$pid" 2>/dev/null || true
    success "Stopped $label"
  fi
}

# ── stop previous run using saved PID files ──────────────────────────────────
info "Checking for previous SRE Copilot processes..."

if [ -f "$BACKEND_PID_FILE" ]; then
  safe_kill "$(cat "$BACKEND_PID_FILE")" "backend"
  rm -f "$BACKEND_PID_FILE"
fi

if [ -f "$FRONTEND_PID_FILE" ]; then
  safe_kill "$(cat "$FRONTEND_PID_FILE")" "frontend"
  rm -f "$FRONTEND_PID_FILE"
fi

# Safety net: also check by full binary path in case PID file is stale/missing.
# We match on the absolute path to OUR venv uvicorn and OUR frontend directory —
# this will never match another project's uvicorn or vite.
STALE_BACKEND=$(pgrep -f "$SCRIPT_DIR/bot/.venv/bin/uvicorn" 2>/dev/null || true)
if [ -n "$STALE_BACKEND" ]; then
  warn "Found stale backend process (PID $STALE_BACKEND) — stopping..."
  kill $STALE_BACKEND 2>/dev/null || true
  sleep 1
fi

STALE_FRONTEND=$(pgrep -f "$SCRIPT_DIR/frontend" 2>/dev/null | grep -v "^$$" || true)
if [ -n "$STALE_FRONTEND" ]; then
  warn "Found stale frontend process (PID $STALE_FRONTEND) — stopping..."
  kill $STALE_FRONTEND 2>/dev/null || true
  sleep 1
fi

# ── start backend ─────────────────────────────────────────────────────────────
info "Starting backend..."
cd "$SCRIPT_DIR"
"$SCRIPT_DIR/bot/.venv/bin/uvicorn" bot.main:app --reload --port 8000 \
  >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

for i in $(seq 1 20); do
  if curl -sf http://localhost:8000/api/v1/incidents > /dev/null 2>&1; then
    success "Backend  → http://localhost:8000  (PID $BACKEND_PID | log: backend.log)"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    err "Backend failed to start. Check backend.log"
    exit 1
  fi
done

# ── start frontend ────────────────────────────────────────────────────────────
info "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"

for i in $(seq 1 20); do
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    success "Frontend → http://localhost:5173  (PID $FRONTEND_PID | log: frontend.log)"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    err "Frontend failed to start. Check frontend.log"
    exit 1
  fi
done

echo ""
success "SRE Copilot is running."
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo ""
echo "  Logs:  tail -f backend.log   |   tail -f frontend.log"
echo "  Stop:  kill \$(cat .backend.pid) \$(cat .frontend.pid)"
echo ""
