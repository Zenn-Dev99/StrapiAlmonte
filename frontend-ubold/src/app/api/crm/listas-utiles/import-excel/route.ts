import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * POST /api/crm/listas-utiles/import-excel
 * Importar lista de útiles desde archivo Excel
 * 
 * Formato esperado:
 * - Material | Tipo | Cantidad | Obligatorio | Descripción
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const nombreLista = formData.get('nombre') as string
    const nivel = formData.get('nivel') as string
    const grado = formData.get('grado') as string
    const descripcion = formData.get('descripcion') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    if (!nombreLista || !nivel || !grado) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: nombre, nivel, grado' },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no válido. Use .xlsx, .xls o .csv' },
        { status: 400 }
      )
    }

    // Leer archivo
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convertir a JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (rawData.length < 2) {
      return NextResponse.json(
        { success: false, error: 'El archivo debe contener al menos una fila de datos (después del encabezado)' },
        { status: 400 }
      )
    }

    // Parsear datos (asumiendo primera fila es encabezado)
    const headers = rawData[0].map((h: any) => String(h || '').toLowerCase().trim())
    const materiales: any[] = []

    // Buscar índices de columnas
    const materialIdx = headers.findIndex(h => h.includes('material') || h.includes('nombre'))
    const tipoIdx = headers.findIndex(h => h.includes('tipo'))
    const cantidadIdx = headers.findIndex(h => h.includes('cantidad'))
    const obligatorioIdx = headers.findIndex(h => h.includes('obligatorio'))
    const descripcionIdx = headers.findIndex(h => h.includes('descripcion') || h.includes('descripción'))

    if (materialIdx === -1) {
      return NextResponse.json(
        { success: false, error: 'No se encontró columna "Material" o "Nombre" en el archivo' },
        { status: 400 }
      )
    }

    // Procesar filas de datos
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      const materialNombre = row[materialIdx] ? String(row[materialIdx]).trim() : ''
      
      if (!materialNombre) continue // Saltar filas vacías

      const tipo = row[tipoIdx] ? String(row[tipoIdx]).trim().toLowerCase() : 'util'
      const cantidad = row[cantidadIdx] ? Number(row[cantidadIdx]) : 1
      const obligatorioRaw = row[obligatorioIdx]
      const obligatorio = obligatorioRaw === true || 
                          String(obligatorioRaw).toLowerCase() === 'sí' ||
                          String(obligatorioRaw).toLowerCase() === 'si' ||
                          String(obligatorioRaw).toLowerCase() === 'true' ||
                          Number(obligatorioRaw) === 1
      const descripcionMaterial = row[descripcionIdx] ? String(row[descripcionIdx]).trim() : ''

      // Validar tipo
      const tiposValidos = ['util', 'libro', 'cuaderno', 'otro']
      const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'util'

      materiales.push({
        material_nombre: materialNombre,
        tipo: tipoFinal,
        cantidad: Math.max(1, cantidad),
        obligatorio: obligatorio,
        descripcion: descripcionMaterial || undefined,
      })
    }

    if (materiales.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron materiales válidos en el archivo' },
        { status: 400 }
      )
    }

    // Retornar preview (el frontend decidirá si guardar o no)
    return NextResponse.json({
      success: true,
      preview: {
        nombre: nombreLista,
        nivel,
        grado: Number(grado),
        descripcion: descripcion || undefined,
        materiales,
      },
      total: materiales.length,
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/import-excel POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar archivo Excel' },
      { status: 500 }
    )
  }
}
