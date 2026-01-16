#!/bin/bash

# Script para monitorear el backup en tiempo real
# Ejecutar en una terminal separada: ./scripts/watch-backup.sh

BACKUP_DIR=$(ls -td backups/backup-* 2>/dev/null | head -1)

if [ -z "$BACKUP_DIR" ]; then
  echo "❌ No se encontró directorio de backup activo"
  exit 1
fi

TOTAL_SCHEMAS=47

# Función para mostrar el estado
show_status() {
  clear
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║     📊 MONITOREO DE BACKUP - PRODUCCIÓN (Actualización Live)  ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📁 Backup: $(basename $BACKUP_DIR)"
  echo "⏰ Hora: $(date '+%H:%M:%S')"
  echo ""
  
  # Contar archivos exportados
  TOTAL_FILES=$(ls -1 $BACKUP_DIR/data/*.json 2>/dev/null | wc -l | tr -d ' ')
  PROGRESO=$(echo "scale=1; ($TOTAL_FILES / $TOTAL_SCHEMAS) * 100" | bc 2>/dev/null || echo "0")
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📈 PROGRESO: $TOTAL_FILES / $TOTAL_SCHEMAS content types ($PROGRESO%)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Barra de progreso visual
  BAR_LENGTH=50
  FILLED=$(echo "scale=0; ($TOTAL_FILES * $BAR_LENGTH) / $TOTAL_SCHEMAS" | bc 2>/dev/null || echo "0")
  EMPTY=$((BAR_LENGTH - FILLED))
  BAR=$(printf "%${FILLED}s" | tr ' ' '█')
  EMPTY_BAR=$(printf "%${EMPTY}s" | tr ' ' '░')
  echo "[$BAR$EMPTY_BAR] $PROGRESO%"
  echo ""
  
  # Total de registros
  TOTAL_RECORDS=0
  for f in $BACKUP_DIR/data/*.json; do
    [ -f "$f" ] && COUNT=$(cat "$f" 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
    TOTAL_RECORDS=$((TOTAL_RECORDS + COUNT))
  done
  echo "📊 Total registros exportados: $TOTAL_RECORDS"
  echo ""
  
  # Archivos completados
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ CONTENT TYPES COMPLETADOS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  COUNT=0
  for f in $BACKUP_DIR/data/*.json; do
    if [ -f "$f" ]; then
      NAME=$(basename "$f" .json)
      SIZE=$(ls -lh "$f" | awk '{print $5}')
      RECORDS=$(cat "$f" 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
      printf "  ✅ %-35s %8s registros  %6s\n" "$NAME" "$RECORDS" "$SIZE"
      COUNT=$((COUNT + 1))
    fi
  done
  
  if [ $COUNT -eq 0 ]; then
    echo "  (ninguno aún)"
  fi
  echo ""
  
  # Estado del proceso y última actividad
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 ESTADO ACTUAL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if ps aux | grep -E "backup-produccion-completo" | grep -v grep > /dev/null; then
    echo "  ✅ Proceso ACTIVO"
    echo ""
    
    # Última actividad del log
    if [ -f /tmp/backup-progress.log ]; then
      LAST_LINE=$(tail -1 /tmp/backup-progress.log 2>/dev/null)
      if echo "$LAST_LINE" | grep -q "Exportando"; then
        CURRENT_CT=$(echo "$LAST_LINE" | grep -o "Exportando [^.]*" | sed 's/Exportando //')
        echo "  📥 Exportando: $CURRENT_CT"
      fi
      
      # Última página procesada
      LAST_PAGE=$(tail -5 /tmp/backup-progress.log 2>/dev/null | grep -o "Página [0-9]*" | tail -1)
      if [ -n "$LAST_PAGE" ]; then
        echo "  📄 $LAST_PAGE"
      fi
      
      # Último total de registros
      LAST_TOTAL=$(tail -5 /tmp/backup-progress.log 2>/dev/null | grep -o "total: [0-9]*" | tail -1 | sed 's/total: //')
      if [ -n "$LAST_TOTAL" ]; then
        echo "  📊 Registros en este content type: $LAST_TOTAL"
      fi
    fi
  else
    echo "  ✅ Proceso COMPLETADO"
    echo ""
    if [ -f "$BACKUP_DIR/summary.json" ]; then
      echo "  📄 Resumen disponible en: summary.json"
    fi
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "💡 Presiona Ctrl+C para salir del monitoreo"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Loop de monitoreo
while true; do
  show_status
  sleep 3  # Actualizar cada 3 segundos
done

