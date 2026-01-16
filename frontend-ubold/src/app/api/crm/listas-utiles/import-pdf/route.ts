import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

/**
 * POST /api/crm/listas-utiles/import-pdf
 * Importar lista de útiles desde archivo PDF usando Claude API
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

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY no configurada' },
        { status: 500 }
      )
    }

    // Validar tipo de archivo
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no válido. Use .pdf' },
        { status: 400 }
      )
    }

    // Extraer texto del PDF usando pdfjs-dist
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    let textoExtraido = ''

    // Extraer texto de todas las páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      textoExtraido += pageText + '\n\n'
    }

    if (!textoExtraido.trim()) {
      return NextResponse.json(
        { success: false, error: 'No se pudo extraer texto del PDF' },
        { status: 400 }
      )
    }

    // Enviar a Claude API para parsear
    const prompt = `Extrae la lista de útiles escolares del siguiente texto y responde SOLO con JSON (sin markdown, sin código, sin explicaciones):

TEXTO:
${textoExtraido.substring(0, 100000)} ${textoExtraido.length > 100000 ? '...' : ''}

FORMATO DE RESPUESTA JSON:
{
  "materiales": [
    {
      "material_nombre": "string",
      "tipo": "util|libro|cuaderno|otro",
      "cantidad": number,
      "obligatorio": boolean,
      "descripcion": "string"
    }
  ]
}

REGLAS:
- Si no se especifica cantidad, usa cantidad=1
- Si no se especifica obligatorio, usa obligatorio=true
- Normaliza nombres de materiales (primera letra mayúscula, resto minúsculas)
- Si el tipo no está claro, usa "util"
- Si no hay descripción, omite el campo
- Solo incluye materiales que tengan un nombre válido`

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.json().catch(() => ({}))
      console.error('[API /listas-utiles/import-pdf] Claude API Error:', errorData)
      return NextResponse.json(
        { success: false, error: 'Error al procesar PDF con Claude API' },
        { status: 500 }
      )
    }

    const claudeData = await claudeResponse.json()
    const claudeText = claudeData.content[0]?.text || '{}'
    
    // Limpiar respuesta de Claude (puede venir con markdown)
    let jsonText = claudeText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?/g, '')
    }

    const parsed = JSON.parse(jsonText)
    const materiales = parsed.materiales || []

    if (materiales.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron materiales en el PDF' },
        { status: 400 }
      )
    }

    // Validar y normalizar materiales
    const materialesValidos = materiales
      .filter((m: any) => m.material_nombre && String(m.material_nombre).trim())
      .map((m: any) => ({
        material_nombre: String(m.material_nombre).trim(),
        tipo: ['util', 'libro', 'cuaderno', 'otro'].includes(m.tipo) ? m.tipo : 'util',
        cantidad: Math.max(1, Number(m.cantidad) || 1),
        obligatorio: m.obligatorio !== undefined ? Boolean(m.obligatorio) : true,
        descripcion: m.descripcion ? String(m.descripcion).trim() : undefined,
      }))

    // Retornar preview
    return NextResponse.json({
      success: true,
      preview: {
        nombre: nombreLista,
        nivel,
        grado: Number(grado),
        descripcion: descripcion || undefined,
        materiales: materialesValidos,
      },
      total: materialesValidos.length,
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/import-pdf POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar archivo PDF' },
      { status: 500 }
    )
  }
}
