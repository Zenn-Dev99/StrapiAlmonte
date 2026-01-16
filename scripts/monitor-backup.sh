#!/bin/bash

# Script para monitorear el progreso del backup

BACKUP_DIR=$(ls -td backups/backup-* 2>/dev/null | head -1)

if [ -z "$BACKUP_DIR" ]; then
  echo "❌ No se encontró directorio de backup activo"
  exit 1
fi

TOTAL_SCHEMAS=47
TOTAL_FILES=$(ls -1 $BACKUP_DIR/data/*.json 2>/dev/null | wc -l | tr -d ' ')
PROGRESO=$(echo "scale=1; ($TOTAL_FILES / $TOTAL_SCHEMAS) * 100" | bc 2>/dev/null || echo "0")

clear
echo "╔════════════════════════════════════════════════════════╗"
echo "║        📊 MONITOREO DE BACKUP - PRODUCCIÓN            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Directorio: $(basename $BACKUP_DIR)"
echo "⏰ Última actualización: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Progreso general
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 PROGRESO GENERAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Content types exportados: $TOTAL_FILES / $TOTAL_SCHEMAS"
echo "  Progreso: $PROGRESO%"
echo ""

# Barra de progreso
BAR_LENGTH=40
FILLED=$(echo "scale=0; ($TOTAL_FILES * $BAR_LENGTH) / $TOTAL_SCHEMAS" | bc 2>/dev/null || echo "0")
EMPTY=$((BAR_LENGTH - FILLED))
BAR=$(printf "%${FILLED}s" | tr ' ' '█')
EMPTY_BAR=$(printf "%${EMPTY}s" | tr ' ' '░')
echo "  [$BAR$EMPTY_BAR] $PROGRESO%"
echo ""

# Total de registros
TOTAL_RECORDS=0
for f in $BACKUP_DIR/data/*.json; do
  [ -f "$f" ] && COUNT=$(cat "$f" 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
  TOTAL_RECORDS=$((TOTAL_RECORDS + COUNT))
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ESTADÍSTICAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Total de registros exportados: $TOTAL_RECORDS"
echo ""

# Archivos exportados
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 CONTENT TYPES EXPORTADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for f in $BACKUP_DIR/data/*.json; do
  if [ -f "$f" ]; then
    NAME=$(basename "$f" .json)
    SIZE=$(ls -lh "$f" | awk '{print $5}')
    COUNT=$(cat "$f" 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
    printf "  ✅ %-30s %8s registros  %6s\n" "$NAME" "$COUNT" "$SIZE"
  fi
done
echo ""

# Estado del proceso
if ps aux | grep -E "backup-produccion-completo" | grep -v grep > /dev/null; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 ESTADO DEL PROCESO"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✅ Proceso activo"
  echo ""
  
  # Última actividad
  if [ -f /tmp/backup-progress.log ]; then
    LAST_ACTIVITY=$(tail -1 /tmp/backup-progress.log 2>/dev/null | grep -o "Exportando.*" | head -1)
    if [ -n "$LAST_ACTIVITY" ]; then
      echo "  📥 Última actividad: $LAST_ACTIVITY"
    fi
  fi
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ BACKUP COMPLETADO"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Verificar si hay summary
  if [ -f "$BACKUP_DIR/summary.json" ]; then
    echo "  📄 Resumen disponible en: $BACKUP_DIR/summary.json"
  fi
fi

echo ""

