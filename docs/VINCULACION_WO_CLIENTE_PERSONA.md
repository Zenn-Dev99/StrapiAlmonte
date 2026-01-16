# 🔗 Vinculación WO-Cliente ↔ Persona

## 📋 Resumen Ejecutivo

Este documento describe la implementación de la vinculación entre **WO-Cliente** (clientes de WooCommerce) y **Persona** (entidad central de personas con RUT, fecha de nacimiento, etc.), permitiendo:

- ✅ Crear persona completa automáticamente cuando se crea un cliente desde WooCommerce
- ✅ Extraer todos los datos posibles de WooCommerce (RUT, fecha nacimiento, teléfono, género, etc.)
- ✅ Vincular wo-cliente con persona automáticamente
- ✅ Sincronizar datos de persona a WooCommerce en meta_data
- ✅ Mantener la mayor cantidad de información posible en un solo lugar

---

## 🎯 Objetivo

El objetivo es tener **la mayor cantidad de información posible** sobre cada cliente, centralizando los datos personales (RUT, fecha de nacimiento, etc.) en el Content Type **Persona**, mientras que los datos de negocio (pedidos, gasto total, AOV) se mantienen en **WO-Cliente**.

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    WOOCOMMERCE                          │
│  Customer (con meta_data: rut, fecha_nacimiento, etc.)  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Webhook / Sync
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    STRAPI                                │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐      │
│  │   WO-Cliente     │────────▶│    Persona       │      │
│  │                  │         │                  │      │
│  │ • pedidos        │         │ • rut            │      │
│  │ • gasto_total    │         │ • nombres        │      │
│  │ • aov            │         │ • apellidos      │      │
│  │ • fecha_registro │         │ • cumpleaños     │      │
│  │ • correo         │         │ • género         │      │
│  │ • persona (FK)   │         │ • emails         │      │
│  └──────────────────┘         │ • telefonos      │      │
│                               └──────────────────┘      │
│                                        │                │
│                                        │                │
│                               ┌────────▼────────┐       │
│                               │  Colaborador    │       │
│                               │  (Intranet)     │       │
│                               └─────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Sincronización

### WooCommerce → Strapi (Webhook)

**Cuando WooCommerce envía un webhook de cliente creado/actualizado:**

1. **Crear/Actualizar WO-Cliente**
   - Se crea o actualiza el registro `wo-cliente` con datos de negocio
   - Se guarda `rawWooData` para trazabilidad

2. **Extraer Datos de meta_data**
   - Se extraen datos personales desde `meta_data` de WooCommerce:
     - `rut` → RUT de la persona
     - `fecha_nacimiento` → Fecha de nacimiento
     - `genero` → Género (Mujer/Hombre)
     - `segundo_apellido` → Segundo apellido
     - `telefono` → Teléfono principal
   - También se extraen desde `billing`/`shipping`:
     - `billing.phone` o `shipping.phone` → Teléfono

3. **Buscar o Crear Persona**
   - **Prioridad 1**: Buscar por RUT (si existe en meta_data)
   - **Prioridad 2**: Buscar por email
   - **Si no existe**: Crear nueva persona con todos los datos disponibles

4. **Crear Persona Completa**
   - Si se crea nueva persona, se incluyen:
     - RUT (normalizado)
     - Nombres y apellidos (desde `first_name`, `last_name`, `segundo_apellido`)
     - Email (principal)
     - Teléfono (si existe)
     - Género (si existe)
     - Fecha de nacimiento (si existe)
     - Origen: `'web'`
     - Identificadores externos de WooCommerce

5. **Actualizar Persona Existente**
   - Si la persona ya existe, se actualiza con datos faltantes:
     - Agregar email si no existe
     - Agregar RUT si no existe
     - Agregar segundo apellido si no existe
     - Agregar género si no existe
     - Agregar fecha de nacimiento si no existe
     - Agregar teléfono si no existe
     - Actualizar identificadores externos

6. **Vincular WO-Cliente con Persona**
   - Se actualiza el campo `persona` en `wo-cliente` con la referencia a la persona

### Strapi → WooCommerce (Sync)

**Cuando se sincroniza un wo-cliente a WooCommerce:**

1. **Obtener Persona Relacionada**
   - Si `wo-cliente` tiene relación con `persona`, se obtiene la persona completa

2. **Agregar Datos a meta_data**
   - Se agregan los siguientes campos a `meta_data` de WooCommerce:
     - `rut` → RUT de la persona
     - `fecha_nacimiento` → Fecha de nacimiento (formato YYYY-MM-DD)
     - `genero` → Género
     - `segundo_apellido` → Segundo apellido
     - `telefono` → Teléfono principal
     - `persona_id` → ID de la persona en Strapi (para referencia)

---

## 📊 Mapeo de Datos

### Extracción desde WooCommerce (meta_data)

| Campo WooCommerce | Campo Persona | Normalización |
|-------------------|---------------|---------------|
| `meta_data[rut]` | `rut` | Remover puntos y guiones |
| `meta_data[fecha_nacimiento]` | `cumpleagno` | Convertir a formato YYYY-MM-DD |
| `meta_data[genero]` | `genero` | Normalizar a "Mujer" o "Hombre" |
| `meta_data[segundo_apellido]` | `segundo_apellido` | Sin normalización |
| `meta_data[telefono]` o `billing.phone` | `telefonos[0]` | Normalizar formato, determinar fijo/móvil |
| `first_name` | `nombres` | Sin normalización |
| `last_name` | `primer_apellido` | Sin normalización |
| `email` | `emails[0]` | Email principal |

### Sincronización a WooCommerce (meta_data)

| Campo Persona | Campo WooCommerce | Formato |
|---------------|-------------------|---------|
| `rut` | `meta_data[rut]` | String |
| `cumpleagno` | `meta_data[fecha_nacimiento]` | YYYY-MM-DD |
| `genero` | `meta_data[genero]` | "Mujer" o "Hombre" |
| `segundo_apellido` | `meta_data[segundo_apellido]` | String |
| `telefonos[0].telefono_norm` | `meta_data[telefono]` | String normalizado |
| `id` | `meta_data[persona_id]` | ID de referencia |

---

## 🔧 Implementación Técnica

### 1. Schema de WO-Cliente

**Archivo:** `strapi/src/api/wo-cliente/content-types/wo-cliente/schema.json`

```json
{
  "attributes": {
    // ... otros campos ...
    "persona": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::persona.persona",
      "description": "Persona asociada al cliente (con RUT, fecha nacimiento, etc.)"
    }
  }
}
```

### 2. Webhook Handler

**Archivo:** `strapi/src/api/woo-webhook/services/woo-webhook.ts`

**Función:** `syncCustomer(wooCustomer, platform)`

**Proceso:**
1. Extrae datos de `meta_data` y `billing`/`shipping`
2. Normaliza RUT, fecha de nacimiento, género, teléfono
3. Busca persona por RUT o email
4. Crea o actualiza persona con todos los datos
5. Vincula wo-cliente con persona

### 3. Customer Mapper

**Archivo:** `strapi/src/api/woo-sync/services/mappers/customer-mapper.ts`

**Función:** `mapWoClienteToWooCustomer(woCliente, platform)`

**Proceso:**
1. Obtiene persona relacionada (si existe)
2. Agrega datos de persona a `meta_data` de WooCommerce
3. Retorna payload completo para sincronización

---

## 🔍 Normalización de Datos

### RUT

```typescript
const normalizeRut = (rutStr: string | null): string | null => {
  if (!rutStr) return null;
  return String(rutStr).replace(/[.\-]/g, '').trim() || null;
};
```

**Ejemplo:**
- `"12.345.678-9"` → `"123456789"`
- `"12345678-9"` → `"123456789"`

### Género

```typescript
const normalizeGenero = (gen: string | null): 'Mujer' | 'Hombre' | null => {
  if (!gen) return null;
  const genLower = String(gen).toLowerCase();
  if (genLower.includes('mujer') || genLower.includes('femenino') || genLower.includes('female') || genLower === 'f') {
    return 'Mujer';
  }
  if (genLower.includes('hombre') || genLower.includes('masculino') || genLower.includes('male') || genLower === 'm') {
    return 'Hombre';
  }
  return null;
};
```

**Ejemplo:**
- `"Femenino"` → `"Mujer"`
- `"Male"` → `"Hombre"`
- `"f"` → `"Mujer"`

### Fecha de Nacimiento

```typescript
const normalizeFechaNacimiento = (fechaStr: string | null): string | null => {
  if (!fechaStr) return null;
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return null;
    return fecha.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  } catch {
    return null;
  }
};
```

**Ejemplo:**
- `"1990-05-15"` → `"1990-05-15"`
- `"1990/05/15"` → `"1990-05-15"`
- `"15-05-1990"` → `"1990-05-15"` (si se puede parsear)

### Teléfono

```typescript
const normalizeTelefono = (tel: string | null): { telefono_norm: string; telefono_raw: string; fijo_o_movil: 'Fijo' | 'Móvil' } | null => {
  if (!tel) return null;
  const telStr = String(tel).trim();
  if (!telStr) return null;
  
  // Remover caracteres no numéricos excepto +
  const telNorm = telStr.replace(/[^\d+]/g, '');
  
  // Determinar si es fijo o móvil (Chile: móvil empieza con 9, fijo con 2)
  const fijoOMovil = telNorm.startsWith('+569') || telNorm.startsWith('9') || (telNorm.length >= 8 && telNorm[0] === '9')
    ? 'Móvil'
    : 'Fijo';
  
  return {
    telefono_norm: telNorm,
    telefono_raw: telStr,
    fijo_o_movil: fijoOMovil,
  };
};
```

**Ejemplo:**
- `"+56 9 1234 5678"` → `{ telefono_norm: "+56912345678", telefono_raw: "+56 9 1234 5678", fijo_o_movil: "Móvil" }`
- `"2 2345 6789"` → `{ telefono_norm: "223456789", telefono_raw: "2 2345 6789", fijo_o_movil: "Fijo" }`

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Cliente Nuevo desde WooCommerce

**Datos en WooCommerce:**
```json
{
  "id": 123,
  "email": "juan.perez@example.com",
  "first_name": "Juan",
  "last_name": "Pérez",
  "billing": {
    "phone": "+56 9 1234 5678"
  },
  "meta_data": [
    { "key": "rut", "value": "12.345.678-9" },
    { "key": "fecha_nacimiento", "value": "1990-05-15" },
    { "key": "genero", "value": "Masculino" },
    { "key": "segundo_apellido", "value": "González" }
  ]
}
```

**Resultado en Strapi:**

**WO-Cliente:**
- `correo_electronico`: `"juan.perez@example.com"`
- `nombre`: `"Juan Pérez"`
- `persona`: `[ID de persona]`
- `rawWooData`: `{ ... }`

**Persona (nueva):**
- `rut`: `"123456789"`
- `nombres`: `"Juan"`
- `primer_apellido`: `"Pérez"`
- `segundo_apellido`: `"González"`
- `cumpleagno`: `"1990-05-15"`
- `genero`: `"Hombre"`
- `emails`: `[{ email: "juan.perez@example.com", principal: true }]`
- `telefonos`: `[{ telefono_norm: "+56912345678", fijo_o_movil: "Móvil", principal: true }]`
- `origen`: `"web"`
- `identificadores_externos`: `{ woo_commerce: { woo_moraleja: { customer_id: 123, ... } } }`

### Ejemplo 2: Actualizar Persona Existente

**Escenario:**
- Persona ya existe con RUT `"123456789"` pero sin fecha de nacimiento
- WooCommerce envía webhook con `fecha_nacimiento: "1990-05-15"`

**Resultado:**
- Se actualiza la persona existente agregando `cumpleagno: "1990-05-15"`
- Se actualiza `identificadores_externos` con referencia a WooCommerce
- Se vincula wo-cliente con persona existente

### Ejemplo 3: Sincronizar a WooCommerce

**Escenario:**
- WO-Cliente tiene relación con Persona
- Persona tiene RUT, fecha de nacimiento, género, teléfono
- Se sincroniza wo-cliente a WooCommerce

**Resultado en WooCommerce:**
- Se agregan a `meta_data`:
  - `rut`: `"123456789"`
  - `fecha_nacimiento`: `"1990-05-15"`
  - `genero`: `"Hombre"`
  - `telefono`: `"+56912345678"`
  - `persona_id`: `"[ID de persona]"`

---

## 🔒 Protección de Datos

### Prioridad de Búsqueda de Persona

1. **Por RUT** (si existe en meta_data)
   - RUT es único en Strapi
   - Si se encuentra, se usa esa persona

2. **Por Email** (si no se encontró por RUT)
   - Busca en el array de emails de personas
   - Si se encuentra, se usa esa persona

3. **Crear Nueva** (si no se encontró)
   - Se crea nueva persona con todos los datos disponibles

### Actualización de Persona Existente

**Solo se agregan datos faltantes:**
- Si persona tiene RUT, no se sobrescribe
- Si persona tiene email, se agrega nuevo email si no existe
- Si persona tiene teléfono, no se sobrescribe
- Si persona tiene fecha de nacimiento, no se sobrescribe

**Siempre se actualiza:**
- `identificadores_externos` con referencia a WooCommerce

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Persona no se vincula con wo-cliente

**Síntoma:**
- Se crea persona pero wo-cliente no tiene relación

**Causa:**
- Error en la actualización de wo-cliente

**Solución:**
- Verificar logs de `[woo-webhook]`
- Verificar que wo-cliente se creó correctamente
- Verificar permisos de actualización

### Problema 2: Datos de persona no se sincronizan a WooCommerce

**Síntoma:**
- Persona tiene RUT pero no aparece en meta_data de WooCommerce

**Causa:**
- wo-cliente no tiene relación con persona
- Error en el mapper

**Solución:**
- Verificar que wo-cliente tiene `persona` relacionada
- Verificar logs de `[customer-mapper]`
- Verificar que el mapper está obteniendo la persona correctamente

### Problema 3: RUT duplicado

**Síntoma:**
- Error al crear persona: RUT ya existe

**Causa:**
- Ya existe persona con ese RUT

**Solución:**
- El sistema busca por RUT primero, debería encontrar la persona existente
- Si no encuentra, verificar normalización de RUT
- Verificar que el RUT en meta_data está correcto

---

## 🔍 Mejoras Futuras

### 1. Sincronización Bidireccional de Datos Personales

**Estado actual:**
- WooCommerce → Strapi: Se extraen datos de persona
- Strapi → WooCommerce: Se envían datos de persona a meta_data

**Mejora propuesta:**
- Si se actualiza persona en Strapi, actualizar también en WooCommerce
- Sincronizar cambios de RUT, fecha de nacimiento, etc.

### 2. Validación de RUT Chileno

**Estado actual:**
- Solo se normaliza RUT (remover puntos y guiones)

**Mejora propuesta:**
- Validar formato de RUT chileno
- Validar dígito verificador
- Rechazar RUTs inválidos

### 3. Relación con Colaborador

**Estado actual:**
- Colaborador tiene relación con Persona
- WO-Cliente tiene relación con Persona

**Mejora propuesta:**
- Si una persona es colaborador, vincular también con wo-cliente
- Permitir que colaboradores sean clientes

### 4. Historial de Cambios

**Estado actual:**
- No se guarda historial de cambios

**Mejora propuesta:**
- Guardar historial de sincronizaciones
- Guardar cambios en datos personales
- Auditoría de modificaciones

---

## 📚 Archivos Modificados

1. **`strapi/src/api/wo-cliente/content-types/wo-cliente/schema.json`**
   - ✅ Agregada relación `persona` (manyToOne)

2. **`strapi/src/api/woo-webhook/services/woo-webhook.ts`**
   - ✅ Mejorada función `syncCustomer` para extraer datos de meta_data
   - ✅ Implementada creación/actualización de persona
   - ✅ Implementada vinculación wo-cliente → persona

3. **`strapi/src/api/woo-sync/services/mappers/customer-mapper.ts`**
   - ✅ Mejorada función `mapWoClienteToWooCustomer` (ahora async)
   - ✅ Implementada obtención de persona relacionada
   - ✅ Implementada sincronización de datos de persona a meta_data

4. **`strapi/src/api/woo-sync/services/woo-customer-sync.ts`**
   - ✅ Actualizado para poblar relación `persona` antes de mapear
   - ✅ Actualizado para usar `await` en mapper (ahora async)

---

## ✅ Checklist de Implementación

- [x] Agregar relación wo-cliente → persona en schema
- [x] Extraer RUT, fecha nacimiento, teléfono, género desde meta_data
- [x] Normalizar datos (RUT, género, fecha, teléfono)
- [x] Buscar persona por RUT o email
- [x] Crear persona completa con todos los datos
- [x] Actualizar persona existente con datos faltantes
- [x] Vincular wo-cliente con persona automáticamente
- [x] Sincronizar datos de persona a WooCommerce en meta_data
- [x] Documentación completa

---

**Última actualización:** 2025-12-22  
**Autor:** Auto (Cursor AI)  
**Versión:** 1.0


