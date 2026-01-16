#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ASSIGN_PERIOD_NAME="2025-09" STRAPI_URL=https://strapi.moraleja.cl IMPORT_TOKEN=$TOKEN \
#   bash scripts/import-assignments-batch.sh data/csv/import_respaldo/asignaciones_equipo.csv 200

CSV_PATH=${1:?Usage: scripts/import-assignments-batch.sh <csv_path> [chunk_size]}
CHUNK_SIZE=${2:-200}
TMP_DIR="$(mktemp -d -t asign-chunks-XXXXXXXX)"

echo "== Batch import asignaciones =="
echo "CSV: $CSV_PATH"
echo "Chunk size: $CHUNK_SIZE"
echo "Tmp dir: $TMP_DIR"

header=$(head -n1 "$CSV_PATH")
tail -n +2 "$CSV_PATH" | awk -v hdr="$header" -v size="$CHUNK_SIZE" -v dir="$TMP_DIR" 'BEGIN{n=0; fileIndex=0} {
  if (n % size == 0) { fileIndex++; fname=sprintf("%s/chunk_%03d.csv", dir, fileIndex); print hdr > fname }
  print $0 >> fname; n++
}
END{ print fileIndex }' > /dev/null

total=$(ls -1 "$TMP_DIR"/chunk_*.csv | wc -l | tr -d ' ')
echo "Chunks: $total"

idx=0; okAll=0; failAll=0
for f in "$TMP_DIR"/chunk_*.csv; do
  idx=$((idx+1))
  echo "-- Chunk $idx/$total: $(basename "$f") --"
  IMPORT_CONCURRENCY=${IMPORT_CONCURRENCY:-3} node scripts/import-assignments-team.mjs "$f" || true
  # Optional: small pause to avoid 502
  sleep 1
done

echo "\n✔ Batch finalizado. Revisa los logs anteriores para el detalle por chunk."

