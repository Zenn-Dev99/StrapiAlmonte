#!/bin/bash

# Script para abrir una nueva ventana de terminal con el monitor
# Funciona en macOS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Abrir nueva ventana de terminal con el monitor
osascript -e "tell application \"Terminal\"" \
  -e "do script \"cd '$PWD' && ./scripts/watch-backup.sh\"" \
  -e "end tell" 2>/dev/null || {
  
  # Si no funciona con osascript, intentar con iTerm2
  osascript -e "tell application \"iTerm\"" \
    -e "tell current window" \
    -e "create tab with default profile" \
    -e "tell current session of current tab" \
    -e "write text \"cd '$PWD' && ./scripts/watch-backup.sh\"" \
    -e "end tell" \
    -e "end tell" \
    -e "end tell" 2>/dev/null || {
    
    echo "⚠️  No se pudo abrir una nueva ventana automáticamente."
    echo ""
    echo "💡 Ejecuta manualmente en una nueva terminal:"
    echo "   cd $PWD"
    echo "   ./scripts/watch-backup.sh"
    echo ""
    echo "O ejecuta este comando para ver el log en tiempo real:"
    echo "   tail -f /tmp/backup-progress.log"
  }
}

