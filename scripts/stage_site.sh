#!/usr/bin/env bash
# Stage the GitHub Pages site into OUTDIR from an explicit allowlist, then check it stays small.
# Images and PDB files are served from Acacia and must never be published to Pages.
# Usage: scripts/stage_site.sh [OUTDIR]   (default _site; MAX_BYTES overrides the 5 MB limit)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-_site}
MAX_BYTES=${MAX_BYTES:-5000000}
FILES=(index.html manifest.json images/not_available.png)

rm -rf "$OUT"
for f in "${FILES[@]}"; do
  install -D -m 0644 "$f" "$OUT/$f"
done
touch "$OUT/.nojekyll"

fail=0
bytes=$(find "$OUT" -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
echo "Pages artifact: $(find "$OUT" -type f | wc -l) files, $bytes bytes (limit $MAX_BYTES)"
if (( bytes > MAX_BYTES )); then echo "ERROR: artifact larger than $MAX_BYTES bytes"; fail=1; fi
heavy=$(find "$OUT" -type f \( -name '*.pdb' -o -name '*.pdb.gz' -o -name '*.gz' -o -name '*.png' \) ! -path "$OUT/images/*")
if [[ -n $heavy ]]; then echo "ERROR: data files in artifact:"; echo "$heavy"; fail=1; fi
if grep -rlq '^version https://git-lfs' "$OUT"; then echo "ERROR: git-lfs pointer files in artifact"; fail=1; fi
exit $fail
