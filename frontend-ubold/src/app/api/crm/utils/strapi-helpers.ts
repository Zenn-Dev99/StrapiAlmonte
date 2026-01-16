/**
 * Utilidades para trabajar con Strapi API
 * Maneja conversión de documentId a id numérico y construcción de queries
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Verifica si un ID es un documentId (string alfanumérico) o un id numérico
 */
export function isDocumentId(id: string | number): boolean {
  if (typeof id === 'number') return false
  // documentId es string alfanumérico (ej: "xvule1pp5in57iyezi3bwnka")
  // id numérico es string de solo dígitos (ej: "123")
  return !/^\d+$/.test(String(id))
}

/**
 * Convierte un documentId a id numérico consultando Strapi
 */
export async function getNumericId(
  contentType: 'colegio' | 'persona' | 'persona-trayectoria',
  documentId: string
): Promise<number | null> {
  try {
    const response = await fetch(`${STRAPI_URL}/api/${contentType === 'persona-trayectoria' ? 'persona-trayectorias' : `${contentType}s`}/${documentId}?fields[0]=id`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`[getNumericId] Error al obtener ID numérico para ${contentType}:`, response.status)
      return null
    }

    const data = await response.json()
    const id = data.data?.id || data.data?.attributes?.id || data.id
    
    if (typeof id === 'number') {
      return id
    }
    
    return null
  } catch (error) {
    console.error(`[getNumericId] Error al convertir documentId a id numérico:`, error)
    return null
  }
}

/**
 * Obtiene el ID numérico (convertiendo documentId si es necesario)
 */
export async function resolveNumericId(
  contentType: 'colegio' | 'persona' | 'persona-trayectoria',
  id: string | number
): Promise<number | null> {
  if (typeof id === 'number') {
    return id
  }

  if (isDocumentId(id)) {
    return await getNumericId(contentType, id)
  }

  // Es un string numérico
  const numericId = parseInt(id, 10)
  return isNaN(numericId) ? null : numericId
}

/**
 * Construye parámetros de populate correctamente para Strapi v4
 */
export function buildPopulateParams(populates: Array<{ path: string; fields?: string[] }>): URLSearchParams {
  const params = new URLSearchParams()
  
  populates.forEach((populate, index) => {
    // Construir el path anidado correctamente
    const pathParts = populate.path.split('.')
    let currentPath = ''
    
    pathParts.forEach((part, partIndex) => {
      if (partIndex === 0) {
        currentPath = `populate[${index}]=${part}`
      } else {
        currentPath = `populate[${index}][populate][${partIndex - 1}]=${part}`
        // Para cada nivel anidado, necesitamos más niveles de populate
        for (let i = 0; i < partIndex - 1; i++) {
          currentPath = currentPath.replace(
            `[populate][${i}]`,
            `[populate][${i}][populate][${i + 1}]`
          )
        }
      }
    })
    
    // Mejor manera: construir de forma iterativa
    let populateKey = `populate[${index}]`
    pathParts.forEach((part, idx) => {
      if (idx === 0) {
        params.append(populateKey, part)
      } else {
        // Para cada nivel adicional, necesitamos anidar populate
        const baseKey = `populate[${index}]`
        let nestedKey = baseKey
        for (let i = 0; i < idx; i++) {
          nestedKey += '[populate]'
        }
        params.append(`${nestedKey}=${part}`, 'true')
      }
    })
    
    // Método más simple: usar sintaxis directa de Strapi v4
    if (populate.path.includes('.')) {
      // Para relaciones anidadas, usar la sintaxis correcta
      const parts = populate.path.split('.')
      params.append(`populate[${index}]`, parts[0])
      parts.slice(1).forEach((part, idx) => {
        const nestedKey = `populate[${index}][populate][${idx}]=${part}`
        // Esto es más complejo, mejor usar un método diferente
      })
    } else {
      params.append(`populate[${index}]`, populate.path)
    }
    
    if (populate.fields && populate.fields.length > 0) {
      populate.fields.forEach((field, fieldIndex) => {
        params.append(`populate[${index}][fields][${fieldIndex}]`, field)
      })
    }
  })
  
  return params
}

/**
 * Construye populate params usando la sintaxis correcta de Strapi v4
 * Sintaxis: populate[0]=campo&populate[1][populate]=campo_anidado
 */
export function buildPopulateQuery(populates: string[]): string {
  const params = new URLSearchParams()
  
  populates.forEach((populate, index) => {
    if (populate.includes('.')) {
      // Para relaciones anidadas: "trayectorias.colegio.comuna"
      const parts = populate.split('.')
      params.append(`populate[${index}]`, parts[0])
      
      // Para cada nivel anidado
      parts.slice(1).forEach((part, nestedIndex) => {
        // Construir la clave anidada correctamente
        let key = `populate[${index}]`
        for (let i = 0; i <= nestedIndex; i++) {
          key += '[populate]'
        }
        params.append(key, part)
      })
    } else {
      // Relación simple
      params.append(`populate[${index}]`, populate)
    }
  })
  
  return params.toString()
}
