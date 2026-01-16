/**
 * Script para probar CRUD completo de Marcas, Etiquetas y Categorías
 * Verifica crear, actualizar y eliminar desde la API de Strapi
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || 'b91253f41ac71a81afd1c6f75edbdc769c04946cbb5f4633b5892b25e32de42753dd78dd7fd265fcd2e3c90cd0b5430e4c4451a71e3c198c179105d64f2bb6e10624a612e35d3903f6335316a31404a8a12583e18827a5fa84c70aad24266b990e895f772d26d3ee8df1b3e9d157a4bfb66e682e1c2a69ff22b5247b0479fc57';

const HEADERS = {
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
  'Content-Type': 'application/json',
};

async function testCRUD(contentType, singularName, pluralName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Probando CRUD de ${singularName}`);
  console.log(`${'='.repeat(60)}\n`);

  let createdId = null;
  let createdDocumentId = null;

  try {
    // 1. CREAR
    console.log('1️⃣  CREAR:');
    const createData = {
      data: {
        name: `Test ${singularName} ${Date.now()}`,
        slug: `test-${singularName.toLowerCase()}-${Date.now()}`,
        descripcion: `Descripción de prueba para ${singularName}`,
      },
    };

    if (contentType === 'categorias-producto') {
      createData.data.tipo_visualizacion = 'default';
      // Asegurar que el slug no tenga caracteres especiales
      createData.data.slug = createData.data.slug.replace(/[^A-Za-z0-9-_.~]/g, '-');
    }

    const createResponse = await fetch(`${STRAPI_URL}/api/${pluralName}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(createData),
    });

    console.log(`   Status: ${createResponse.status} ${createResponse.statusText}`);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log(`   ❌ Error: ${errorText}`);
      return;
    }

    const created = await createResponse.json();
    createdId = created.data?.id;
    createdDocumentId = created.data?.documentId || created.data?.id;
    
    console.log(`   ✅ Creado: ID=${createdId}, documentId=${createdDocumentId}`);
    console.log(`   Data:`, JSON.stringify(created.data, null, 2));

    if (!createdId && !createdDocumentId) {
      console.log(`   ⚠️  No se pudo obtener ID del elemento creado`);
      return;
    }

    // Esperar un poco para que se procese
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. LEER (verificar que existe)
    console.log(`\n2️⃣  LEER (verificar existencia):`);
    const identifier = createdDocumentId || createdId;
    const readResponse = await fetch(`${STRAPI_URL}/api/${pluralName}/${identifier}`, {
      method: 'GET',
      headers: HEADERS,
    });

    console.log(`   Status: ${readResponse.status} ${readResponse.statusText}`);
    
    if (readResponse.ok) {
      const readData = await readResponse.json();
      console.log(`   ✅ Encontrado: ${readData.data?.name || 'N/A'}`);
    } else {
      const errorText = await readResponse.text();
      console.log(`   ❌ Error: ${errorText}`);
    }

    // 3. ACTUALIZAR
    console.log(`\n3️⃣  ACTUALIZAR:`);
    const updateData = {
      data: {
        name: `Test ${singularName} ACTUALIZADO ${Date.now()}`,
        descripcion: `Descripción ACTUALIZADA para ${singularName}`,
      },
    };

    // Intentar con documentId primero, luego con id
    const updateIdentifiers = [createdDocumentId, createdId].filter(Boolean);
    
    let updateSuccess = false;
    for (const updateId of updateIdentifiers) {
      const updateResponse = await fetch(`${STRAPI_URL}/api/${pluralName}/${updateId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(updateData),
      });

      console.log(`   Intentando con ID: ${updateId}`);
      console.log(`   Status: ${updateResponse.status} ${updateResponse.statusText}`);

      if (updateResponse.ok) {
        const updated = await updateResponse.json();
        console.log(`   ✅ Actualizado: ${updated.data?.name || 'N/A'}`);
        updateSuccess = true;
        break;
      } else {
        const errorText = await updateResponse.text();
        console.log(`   ❌ Error: ${errorText.substring(0, 200)}`);
      }
    }

    if (!updateSuccess) {
      console.log(`   ⚠️  No se pudo actualizar con ningún identificador`);
    }

    // Esperar un poco
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. ELIMINAR
    console.log(`\n4️⃣  ELIMINAR:`);
    const deleteIdentifiers = [createdDocumentId, createdId].filter(Boolean);
    
    let deleteSuccess = false;
    for (const deleteId of deleteIdentifiers) {
      const deleteResponse = await fetch(`${STRAPI_URL}/api/${pluralName}/${deleteId}`, {
        method: 'DELETE',
        headers: HEADERS,
      });

      console.log(`   Intentando con ID: ${deleteId}`);
      console.log(`   Status: ${deleteResponse.status} ${deleteResponse.statusText}`);

      if (deleteResponse.ok) {
        const deleted = await deleteResponse.json();
        console.log(`   ✅ Eliminado exitosamente`);
        deleteSuccess = true;
        break;
      } else {
        const errorText = await deleteResponse.text();
        console.log(`   ❌ Error: ${errorText.substring(0, 200)}`);
      }
    }

    if (!deleteSuccess) {
      console.log(`   ⚠️  No se pudo eliminar con ningún identificador`);
    }

  } catch (error) {
    console.error(`   ❌ Error inesperado:`, error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando pruebas CRUD de Marcas, Etiquetas y Categorías\n');
  console.log(`📍 Strapi URL: ${STRAPI_URL}`);
  console.log(`🔑 Token: ${STRAPI_TOKEN.substring(0, 20)}...\n`);

  // Probar cada content type
  await testCRUD('marcas', 'Marca', 'marcas');
  await testCRUD('etiquetas', 'Etiqueta', 'etiquetas');
  await testCRUD('categorias-producto', 'Categoría', 'categorias-producto');

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Pruebas completadas');
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
