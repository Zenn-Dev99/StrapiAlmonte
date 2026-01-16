#!/bin/bash

# Visor de avance de importación en tiempo real
# Uso: ./scripts/ver-avance-importacion.sh

LOG_FILE="/tmp/import-backup.log"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear

while true; do
  # Verificar si el proceso está corriendo
  if ! pgrep -f "importar-backup-local.mjs" > /dev/null; then
    echo -e "${YELLOW}⚠️  Proceso de importación no está corriendo${NC}"
    echo ""
    echo "Para iniciar la importación:"
    echo "  cd backend && STRAPI_LOCAL_URL=http://localhost:1337 node scripts/importar-backup-local.mjs backups/backup-2025-11-17T23-20-11 > /tmp/import-backup.log 2>&1 &"
    sleep 5
    continue
  fi

  # Limpiar pantalla
  clear
  
  echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║     📊 VISOR DE AVANCE - IMPORTACIÓN PRODUCCIÓN → LOCAL${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}❌ Archivo de log no encontrado: $LOG_FILE${NC}"
    sleep 3
    continue
  fi
  
  # Extraer información del log
  TOTAL_CTS=$(grep -c "📦 Importando" "$LOG_FILE" 2>/dev/null || echo "0")
  COMPLETED_CTS=$(grep -c "✅.*registros importados" "$LOG_FILE" 2>/dev/null || echo "0")
  
  # Contar registros importados
  TOTAL_IMPORTED=$(grep "✅.*registros importados" "$LOG_FILE" 2>/dev/null | grep -oE "[0-9]+ registros importados" | awk '{sum+=$1} END {print sum+0}')
  
  # Contar errores
  TOTAL_ERRORS=$(grep -c "⚠️.*errores" "$LOG_FILE" 2>/dev/null || echo "0")
  ERROR_COUNT=$(grep "⚠️.*errores" "$LOG_FILE" 2>/dev/null | grep -oE "[0-9]+ errores" | awk '{sum+=$1} END {print sum+0}')
  
  # Obtener el content type actual
  CURRENT_CT=$(grep "📦 Importando" "$LOG_FILE" 2>/dev/null | tail -1 | sed 's/.*📦 Importando //' | sed 's/\.\.\..*//')
  
  # Obtener progreso del content type actual
  if [ -n "$CURRENT_CT" ]; then
    CURRENT_PROGRESS=$(grep -A 5 "📦 Importando $CURRENT_CT" "$LOG_FILE" 2>/dev/null | grep "Progreso:" | tail -1 | sed 's/.*Progreso: //' | sed 's/ (.*//')
    CURRENT_SUCCESS=$(grep -A 5 "📦 Importando $CURRENT_CT" "$LOG_FILE" 2>/dev/null | grep "Progreso:" | tail -1 | grep -oE "[0-9]+ OK" | grep -oE "[0-9]+" || echo "0")
    CURRENT_ERRORS=$(grep -A 5 "📦 Importando $CURRENT_CT" "$LOG_FILE" 2>/dev/null | grep "Progreso:" | tail -1 | grep -oE "[0-9]+ errores" | grep -oE "[0-9]+" || echo "0")
  fi
  
  # Verificar si terminó
  if grep -q "✅ Importación completada\|🎉.*completada" "$LOG_FILE" 2>/dev/null; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📈 ESTADO: ✅ COMPLETADA${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  elif [ -n "$CURRENT_CT" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📈 ESTADO: 🔄 EN PROGRESO${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  else
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📈 ESTADO: ⏳ INICIANDO...${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi
  
  echo ""
  echo -e "${CYAN}📊 PROGRESO GENERAL${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Content types procesados: ${GREEN}$COMPLETED_CTS${NC} / ${BLUE}$TOTAL_CTS${NC}"
  echo -e "  Registros importados: ${GREEN}$TOTAL_IMPORTED${NC}"
  echo -e "  Errores totales: ${RED}$ERROR_COUNT${NC}"
  
  if [ "$TOTAL_CTS" -gt 0 ]; then
    PERCENTAGE=$((COMPLETED_CTS * 100 / TOTAL_CTS))
    echo ""
    echo -e "  Progreso: [${GREEN}$(printf '%*s' $((PERCENTAGE / 2)) | tr ' ' '█')${NC}${YELLOW}$(printf '%*s' $((50 - PERCENTAGE / 2)) | tr ' ' '░')${NC}] ${PERCENTAGE}%"
  fi
  
  echo ""
  
  if [ -n "$CURRENT_CT" ]; then
    echo -e "${CYAN}📦 CONTENT TYPE ACTUAL${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Nombre: ${BLUE}$CURRENT_CT${NC}"
    if [ -n "$CURRENT_PROGRESS" ]; then
      echo -e "  Progreso: ${BLUE}$CURRENT_PROGRESS${NC}"
    fi
    echo -e "  ✅ Exitosos: ${GREEN}$CURRENT_SUCCESS${NC}"
    echo -e "  ❌ Errores: ${RED}$CURRENT_ERRORS${NC}"
    echo ""
  fi
  
  echo -e "${CYAN}📋 ÚLTIMAS ACTIVIDADES${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  tail -10 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
    if echo "$line" | grep -q "✅.*registros importados"; then
      echo -e "  ${GREEN}✅ $line${NC}"
    elif echo "$line" | grep -q "⚠️.*errores"; then
      echo -e "  ${RED}⚠️  $line${NC}"
    elif echo "$line" | grep -q "📦 Importando"; then
      echo -e "  ${BLUE}📦 $line${NC}"
    elif echo "$line" | grep -q "Schema local encontrado"; then
      echo -e "  ${CYAN}📋 $line${NC}"
    else
      echo "  $line"
    fi
  done
  
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}⏱️  Actualizado: $(date '+%H:%M:%S')${NC}"
  echo -e "${YELLOW}💡 Presiona Ctrl+C para salir${NC}"
  echo ""
  
  sleep 3
done

