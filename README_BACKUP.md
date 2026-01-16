# 📦 Backup de Producción - Guía Rápida

## 🚀 Comandos Útiles

### Monitorear el Backup en Tiempo Real

**Opción 1: Ventana separada (recomendado)**
```bash
./scripts/watch-backup.sh
```
Este script se actualiza automáticamente cada 3 segundos mostrando:
- Progreso general
- Content types completados
- Registros exportados
- Estado actual del proceso

**Opción 2: Ver el log directamente**
```bash
tail -f /tmp/backup-progress.log
```

**Opción 3: Estado rápido**
```bash
./scripts/monitor-backup.sh
```

### Verificar Estado del Backup

```bash
# Ver archivos exportados
ls -lh backups/backup-*/data/*.json

# Ver resumen (cuando termine)
cat backups/backup-*/summary.json | jq

# Contar registros totales
for f in backups/backup-*/data/*.json; do 
  echo "$(basename $f): $(cat $f | jq 'length') registros"
done
```

## 📊 Estado Actual

El backup está ejecutándose en segundo plano. Puedes:
- ✅ Trabajar en otras cosas mientras se completa
- ✅ Monitorear el progreso en la ventana que se abrió
- ✅ Verificar el estado cuando quieras con los comandos arriba

## 📁 Ubicación del Backup

Los backups se guardan en:
```
backups/backup-YYYY-MM-DDTHH-MM-SS/
├── schemas/          # Schemas de content types y components
├── data/             # Datos exportados (JSON por content type)
└── summary.json      # Resumen del backup (se crea al finalizar)
```

## ⚠️ Notas

- El proceso puede tardar varios minutos dependiendo del volumen de datos
- Si se interrumpe, puedes re-ejecutar el script (solo exportará lo que falte)
- Los archivos se guardan cuando cada content type termina de exportarse

