#!/bin/bash

# Script temporal para hacer backup de producción
# Usa los tokens proporcionados directamente

set -e

echo "📦 Iniciando backup de producción..."
echo ""

# Tokens (configurados directamente aquí - solo para este backup)
export TRANSFER_TOKEN="abf2a7932582455eb163c04c5ad3569fa4b6a766a731a2f56ec8bfe5504f313d9b8b3fa437a9696ad8fa362136737a9bddfcda1d4484bd82c4bcae823f3d2b2a62cd33f7eb39642a8789754fcae66b5524890084cf6983107a9b6f9b1a3a13955d47e28b349a6a2308156d30ebd5e6a4d1addeedd3d2cc7dc2e56faeb320e0ea"
export TOKEN_PROD="7ec698220a846b42b6844444486519d8865266af7debdc6bb56004513991d5d2df374409683583e4b68b7bf5e25dde1393605ef0d6b2f36f1cd777a4c4e8b9578250c948c09990602bbafc4c52f32fc14fcda846d75a93b75ddc3555dd7eda219b7153fdacadbb28c5b1d1262d51de03c6c7dff357bdee60858e10367ed630db"
export STRAPI_URL="https://strapi.moraleja.cl"

# Crear directorio de backups si no existe
mkdir -p backups

echo "🔐 Tokens configurados"
echo "🌐 URL: $STRAPI_URL"
echo ""

# Método 1: Strapi Transfer (recomendado - pero necesita TRANSFER_SECRET)
echo "⚠️  Para usar Strapi Transfer necesitas el TRANSFER_SECRET"
echo "   (solo se muestra una vez al crear el token)"
echo ""

# Método 2: Script personalizado (solo datos)
echo "📊 Usando script personalizado (exporta datos vía API)..."
echo ""

cd "$(dirname "$0")/.."
node scripts/backup-produccion-completo.mjs

echo ""
echo "✅ Backup completado!"
echo "📁 Revisa el directorio: backups/backup-*"

