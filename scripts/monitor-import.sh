#!/bin/bash

# Script para monitorear el progreso de la importación

LOG_FILE="/tmp/import-backup.log"
BACKUP_DIR="${1:-backups/backup-2025-11-17T23-20-11}"

if [ ! -f "$LOG_FILE" ]; then
  echo "⚠️  No se encontró el log de importación"
  echo "   Ejecuta primero: npm run import:backup:latest"
  exit 1
fi

# Obtener estadísticas del backup
if [ -f "$BACKUP_DIR/summary.json" ]; then
  TOTAL_RECORDS=$(cat "$BACKUP_DIR/summary.json" | grep -o '"totalRecords":[0-9]*' | cut -d':' -f2)
  TOTAL_CTS=$(cat "$BACKUP_DIR/summary.json" | grep -o '"name"' | wc -l | tr -d ' ')
else
  TOTAL_RECORDS=49235
  TOTAL_CTS=47
fi

# Extraer información del log
LAST_LINE=$(tail -1 "$LOG_FILE" 2>/dev/null)

# Contar content types procesados
CTS_PROCESSED=$(grep -c "📦 Importando" "$LOG_FILE" 2>/dev/null || echo "0")

# Contar registros importados
RECORDS_IMPORTED=$(grep -o "✅ [0-9]* registros importados" "$LOG_FILE" 2>/dev/null | grep -o "[0-9]*" | awk '{s+=$1} END {print s}' || echo "0")

# Contar errores
ERRORS=$(grep -o "⚠️  [0-9]* errores" "$LOG_FILE" 2>/dev/null | grep -o "[0-9]*" | awk '{s+=$1} END {print s}' || echo "0")

# Verificar si está completado
if grep -q "✅ Importación completada" "$LOG_FILE" 2>/dev/null; then
  STATUS="✅ COMPLETADO"
  PROGRESS=100
elif grep -q "📦 Importando" "$LOG_FILE" 2>/dev/null; then
  STATUS="🔄 EN PROGRESO"
  if [ "$TOTAL_CTS" -gt 0 ]; then
    PROGRESS=$((CTS_PROCESSED * 100 / TOTAL_CTS))
  else
    PROGRESS=0
  fi
else
  STATUS="⏳ INICIANDO"
  PROGRESS=0
fi

# Mostrar información
clear
echo "╔════════════════════════════════════════════════════════╗"
echo "║        📊 MONITOREO DE IMPORTACIÓN                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 PROGRESO GENERAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Estado: $STATUS"
echo "  Content types procesados: $CTS_PROCESSED / $TOTAL_CTS"
echo "  Registros importados: $RECORDS_IMPORTED / $TOTAL_RECORDS"
echo "  Errores: $ERRORS"
echo ""

# Barra de progreso
BAR_WIDTH=50
FILLED=$((PROGRESS * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))

printf "  Progreso: ["
printf "%${FILLED}s" | tr ' ' '█'
printf "%${EMPTY}s" | tr ' ' '░'
printf "] %d%%\n" "$PROGRESS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ÚLTIMAS ACTIVIDADES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Mostrar últimos content types procesados
echo ""
grep "📦 Importando\|✅.*registros importados\|⚠️.*errores" "$LOG_FILE" 2>/dev/null | tail -5 | while read line; do
  echo "  $line"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 ÚLTIMA LÍNEA DEL LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $LAST_LINE"
echo ""

