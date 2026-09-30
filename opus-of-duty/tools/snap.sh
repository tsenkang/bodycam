#!/usr/bin/env bash
# Queued capture for parallel agents on a CPU-only box.
#
# Software GL saturates every core, so two captures at once each run ~2x slower
# and a crowd of them never finishes. Every capture — the full game (shotset)
# or a subsystem preview script — goes through one machine-wide lock.
#
#   tools/snap.sh <out-dir> <shot,shot,...> [port]           # full game shots
#   tools/snap.sh --raw <command...>                           # any capture command
set -euo pipefail
LOCK=/tmp/ood-capture.lock
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "${1:-}" == "--raw" ]]; then
  shift
  exec flock "$LOCK" "$@"
fi
OUT="$1"; SHOTS="$2"; PORT="${3:-5173}"
cd "$ROOT"
exec flock "$LOCK" node tools/shotset.mjs --w="${W:-1280}" --h="${H:-720}" --settle="${SETTLE:-6}" \
  --port="$PORT" --shots="$SHOTS" --out="$OUT"
