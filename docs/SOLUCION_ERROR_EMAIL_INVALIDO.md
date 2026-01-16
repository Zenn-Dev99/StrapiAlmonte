# 🔧 Solución: Error de Email Inválido en Sincronización de Pedidos

## 🚨 **PROBLEMA IDENTIFICADO**

Al actualizar un pedido en Strapi, la sincronización con WooCommerce fallaba con este error:

```
❌ [pedido.service] Error 400 al actualizar pedido:
Parámetro(s) no válido(s): billing
"Correo electrónico no valido."
```

**Causa raíz:** El campo `billing.email` del pedido contenía un email inválido (formato incorrecto, vacío, o null), y WooCommerce lo rechazaba en su validación.

---

## ✅ **SOLUCIÓN IMPLEMENTADA**

He agregado validación y sanitización automática de datos antes de enviar a WooCommerce.

### **Cambios realizados:**

#### **1. Nueva función de validación de emails:**

```typescript
isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // Regex básica para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
```

**Qué valida:**
- ✅ Formato correcto: `usuario@dominio.com`
- ❌ Rechaza: emails vacíos, null, undefined, formatos incorrectos

---

#### **2. Nueva función de sanitización:**

```typescript
sanitizeBillingShipping(data: any, tipo: 'billing' | 'shipping'): any | null {
  // 1. Valida que data sea un objeto
  // 2. Extrae solo campos válidos de WooCommerce
  // 3. Valida el email específicamente
  // 4. Omite campos vacíos o nulos
  // 5. Retorna objeto limpio o null si está vacío
}
```

**Qué hace:**
- ✅ Solo incluye campos válidos de WooCommerce
- ✅ Valida el email antes de incluirlo
- ✅ Omite el email si es inválido (en lugar de fallar todo)
- ✅ Limpia espacios en blanco (trim)
- ✅ Retorna `null` si no hay datos válidos

**Campos válidos procesados:**
- `first_name`, `last_name`, `company`
- `address_1`, `address_2`
- `city`, `state`, `postcode`, `country`
- `email` (con validación especial), `phone`

---

#### **3. Uso en `buildWooOrder`:**

**❌ ANTES (sin validación):**
```typescript
// Copiaba directamente sin validar
if (pedido.billing && typeof pedido.billing === 'object') {
  wooOrder.billing = pedido.billing; // ⚠️ Email inválido pasaba
}
```

**✅ AHORA (con validación):**
```typescript
if (pedido.billing && typeof pedido.billing === 'object') {
  const sanitizedBilling = this.sanitizeBillingShipping(pedido.billing, 'billing');
  if (sanitizedBilling) {
    wooOrder.billing = sanitizedBilling;
    console.log('[pedido.service] ✅ Billing validado y agregado');
  } else {
    console.warn('[pedido.service] ⚠️  Billing omitido (datos inválidos o vacíos)');
  }
}
```

**Resultado:**
- ✅ Si el email es válido → se incluye
- ⚠️ Si el email es inválido → se omite solo el email, el resto de billing sigue
- 🔄 La sincronización continúa sin fallar

---

#### **4. Logging mejorado en errores:**

**❌ ANTES:**
```
❌ [pedido.service] Error 400 al actualizar pedido:
{...JSON completo...}
```

**✅ AHORA:**
```
❌ [pedido.service] Error 400 al actualizar pedido:
❌ [pedido.service] Parámetros inválidos:
   - billing: Correo electrónico no valido.
❌ [pedido.service] Detalles del error:
{
  "billing": {
    "code": "rest_invalid_email",
    "message": "Correo electrónico no valido.",
    "data": null
  }
}
```

**Ventajas:**
- 📋 Identifica exactamente qué campo falló
- 🔍 Muestra el mensaje de error específico
- 🎯 Facilita el debugging

---

## 🧪 **CÓMO FUNCIONA LA VALIDACIÓN**

### **Ejemplo 1: Email válido ✅**

**Pedido en Strapi:**
```json
{
  "billing": {
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan.perez@example.com",
    "phone": "+56912345678",
    "address_1": "Av. Providencia 123"
  }
}
```

**Resultado:**
```json
{
  "billing": {
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan.perez@example.com",  // ✅ Incluido
    "phone": "+56912345678",
    "address_1": "Av. Providencia 123"
  }
}
```

**Log:**
```
[pedido.service] ✅ Billing validado y agregado
```

---

### **Ejemplo 2: Email inválido ⚠️**

**Pedido en Strapi:**
```json
{
  "billing": {
    "first_name": "María",
    "last_name": "González",
    "email": "email-invalido",  // ❌ Email sin formato correcto
    "phone": "+56987654321",
    "address_1": "Calle Falsa 123"
  }
}
```

**Resultado (email omitido):**
```json
{
  "billing": {
    "first_name": "María",
    "last_name": "González",
    // ⚠️ email omitido
    "phone": "+56987654321",
    "address_1": "Calle Falsa 123"
  }
}
```

**Log:**
```
[pedido.service] ⚠️  Email inválido en billing: "email-invalido" - será omitido
[pedido.service] ✅ Billing validado y agregado
```

**Resultado final:**
- ✅ El pedido SE ACTUALIZA en WooCommerce
- ⚠️ El email inválido NO se incluye
- ✅ El resto de datos billing SÍ se incluyen
- ✅ No hay error 400

---

### **Ejemplo 3: Billing vacío o solo email inválido**

**Pedido en Strapi:**
```json
{
  "billing": {
    "email": "no-es-email"  // Solo tiene email inválido
  }
}
```

**Resultado:**
```json
{
  // ⚠️ billing omitido completamente
}
```

**Log:**
```
[pedido.service] ⚠️  Email inválido en billing: "no-es-email" - será omitido
[pedido.service] ⚠️  Billing omitido (datos inválidos o vacíos)
```

**Resultado final:**
- ✅ El pedido SE ACTUALIZA en WooCommerce
- ⚠️ Sin datos de billing
- ✅ No hay error 400

---

## 📋 **FORMATOS DE EMAIL VÁLIDOS**

### ✅ **Válidos:**
```
juan.perez@example.com
maria_gonzalez@empresa.cl
contacto@moraleja.cl
usuario+etiqueta@dominio.com
nombre123@sub.dominio.co.uk
```

### ❌ **Inválidos:**
```
email-sin-arroba
usuario@
@dominio.com
usuario @dominio.com (con espacios)
usuario@dominio (sin TLD)
(vacío)
null
undefined
```

---

## 🔧 **RECOMENDACIONES PARA LA INTRANET**

### **1. Validar emails en el frontend antes de enviar:**

```javascript
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Antes de enviar el formulario
if (billing.email && !validarEmail(billing.email)) {
  alert('El email de billing es inválido');
  return;
}

// Proceder con el POST/PUT
```

### **2. Validación en tiempo real (opcional):**

```javascript
<input
  type="email"
  value={billing.email}
  onChange={(e) => {
    const email = e.target.value;
    setBilling({ ...billing, email });
    
    // Validar en tiempo real
    if (email && !validarEmail(email)) {
      setEmailError('Email inválido');
    } else {
      setEmailError('');
    }
  }}
/>
{emailError && <span className="error">{emailError}</span>}
```

### **3. Campos requeridos mínimos:**

Para que un pedido se sincronice correctamente a WooCommerce, incluir al menos:

**Billing:**
- `first_name` ✅
- `last_name` ✅
- `email` ✅ (con formato válido)
- `phone`
- `address_1` ✅
- `city` ✅
- `country` ✅ (código de 2 letras: "CL", "US", etc.)

**Shipping:**
- `first_name` ✅
- `last_name` ✅
- `address_1` ✅
- `city` ✅
- `country` ✅

---

## 🚨 **QUÉ HACER SI VES ESTE ERROR**

### **Si ves en los logs:**

```
[pedido.service] ⚠️  Email inválido en billing: "..." - será omitido
```

**Acción:**
1. ✅ No hacer nada - el sistema ya lo manejó automáticamente
2. 📝 Revisar de dónde viene ese email inválido en la Intranet
3. 🔧 Agregar validación frontend para prevenir futuros casos

### **Si ves:**

```
❌ [pedido.service] Error 400 al actualizar pedido:
❌ [pedido.service] Parámetros inválidos:
   - billing: ...
```

**Significa:**
- La validación no pudo resolver el problema automáticamente
- Hay un problema más grave con los datos de billing
- Revisar el payload completo en los logs

**Acción:**
1. Copiar el payload completo del log
2. Identificar qué campo específico está mal
3. Corregir en la Intranet o en Strapi Admin

---

## 📊 **TESTING**

### **Probar la validación:**

1. **Crear pedido con email válido:**
   ```json
   POST /api/pedidos
   {
     "data": {
       "billing": {
         "email": "test@example.com",
         ...
       }
     }
   }
   ```
   **Esperado:** ✅ Se crea en WooCommerce con email

2. **Crear pedido con email inválido:**
   ```json
   POST /api/pedidos
   {
     "data": {
       "billing": {
         "email": "email-malo",
         ...
       }
     }
   }
   ```
   **Esperado:** ✅ Se crea en WooCommerce sin email
   **Log:** ⚠️ Email omitido

3. **Actualizar pedido cambiando email:**
   ```json
   PUT /api/pedidos/:id
   {
     "data": {
       "billing": {
         "email": "nuevo@example.com"
       }
     }
   }
   ```
   **Esperado:** ✅ Se actualiza en WooCommerce con nuevo email

---

## ✅ **CHECKLIST DE VALIDACIÓN**

Antes de enviar un pedido a Strapi:

- [ ] Email tiene formato válido (`usuario@dominio.com`)
- [ ] Email no está vacío ni es null
- [ ] Billing tiene al menos: `first_name`, `last_name`, `address_1`, `city`, `country`
- [ ] Shipping tiene al menos: `first_name`, `last_name`, `address_1`, `city`, `country`
- [ ] País es código de 2 letras (`CL`, `US`, no `Chile`)
- [ ] Teléfono tiene formato válido (opcional pero recomendado)

---

## 📚 **ARCHIVOS MODIFICADOS**

```
✅ strapi/src/api/pedido/services/pedido.ts
   - Función isValidEmail() agregada
   - Función sanitizeBillingShipping() agregada
   - buildWooOrder() modificado (usa sanitización)
   - createWooOrder() mejorado (logging de errores)
   - updateWooOrder() mejorado (logging de errores)
```

---

## 🎯 **RESUMEN**

**Antes:**
- ❌ Email inválido → Error 400 → Sincronización fallaba
- ❌ No se actualizaba el pedido en WooCommerce
- ❌ Logs genéricos difíciles de debuggear

**Ahora:**
- ✅ Email inválido → Se omite automáticamente
- ✅ Pedido se actualiza sin problemas
- ✅ Logs claros y específicos
- ✅ Sistema más resiliente

---

**Última actualización:** 2025-12-28  
**Commit:** 1faa9ed

