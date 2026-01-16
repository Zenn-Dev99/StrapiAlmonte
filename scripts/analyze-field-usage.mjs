#!/usr/bin/env node
/**
 * Script de análisis de uso de campos en Content Types
 * Analiza tanto el uso en código como en datos para identificar campos no utilizados
 * 
 * Uso: node scripts/analyze-field-usage.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Content Types a analizar
const CONTENT_TYPES = [
  { uid: 'api::colegio.colegio', name: 'Colegio', schemaPath: 'src/api/colegio/content-types/colegio/schema.json' },
  { uid: 'api::persona.persona', name: 'Persona', schemaPath: 'src/api/persona/content-types/persona/schema.json' },
];

// Directorios donde buscar uso de campos
const CODE_DIRECTORIES = [
  'src/api',
  'scripts',
];

/**
 * Lee el schema de un Content Type
 */
function readSchema(schemaPath) {
  const fullPath = path.join(projectRoot, schemaPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

/**
 * Extrae todos los nombres de campos de un schema
 */
function extractFields(schema) {
  if (!schema || !schema.attributes) return [];
  return Object.keys(schema.attributes);
}

/**
 * Busca uso de un campo en el código
 */
function findFieldUsageInCode(fieldName, contentTypeName) {
  const usage = {
    inControllers: [],
    inServices: [],
    inScripts: [],
    inRoutes: [],
    inLifecycles: [],
    totalMatches: 0,
  };

  const patterns = [
    // Patrones comunes de uso
    new RegExp(`\\b${fieldName}\\b`, 'gi'),
    new RegExp(`['"]${fieldName}['"]`, 'gi'),
    new RegExp(`\\.${fieldName}\\b`, 'gi'),
    new RegExp(`\\[['"]${fieldName}['"]\\]`, 'gi'),
  ];

  // Buscar en diferentes tipos de archivos
  const filePatterns = [
    `${CODE_DIRECTORIES[0]}/${contentTypeName}/**/*.{ts,js}`,
    `${CODE_DIRECTORIES[1]}/**/*.{ts,js,mjs,cjs}`,
  ];

  for (const pattern of filePatterns) {
    try {
      const files = glob.sync(pattern, { cwd: projectRoot, absolute: true });
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(projectRoot, file);
        
        for (const regex of patterns) {
          const matches = content.match(regex);
          if (matches && matches.length > 0) {
            usage.totalMatches += matches.length;
            
            // Categorizar por tipo de archivo
            if (relativePath.includes('controllers')) {
              usage.inControllers.push(relativePath);
            } else if (relativePath.includes('services')) {
              usage.inServices.push(relativePath);
            } else if (relativePath.includes('routes')) {
              usage.inRoutes.push(relativePath);
            } else if (relativePath.includes('lifecycles')) {
              usage.inLifecycles.push(relativePath);
            } else if (relativePath.includes('scripts')) {
              usage.inScripts.push(relativePath);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Error buscando en ${pattern}:`, error.message);
    }
  }

  // Eliminar duplicados
  usage.inControllers = [...new Set(usage.inControllers)];
  usage.inServices = [...new Set(usage.inServices)];
  usage.inScripts = [...new Set(usage.inScripts)];
  usage.inRoutes = [...new Set(usage.inRoutes)];
  usage.inLifecycles = [...new Set(usage.inLifecycles)];

  return usage;
}

/**
 * Analiza relaciones y componentes
 */
function analyzeRelations(schema) {
  if (!schema || !schema.attributes) return { relations: [], components: [] };
  
  const relations = [];
  const components = [];
  
  for (const [fieldName, fieldDef] of Object.entries(schema.attributes)) {
    if (fieldDef.type === 'relation') {
      relations.push({
        field: fieldName,
        relation: fieldDef.relation,
        target: fieldDef.target,
        mappedBy: fieldDef.mappedBy,
        inversedBy: fieldDef.inversedBy,
      });
    } else if (fieldDef.type === 'component') {
      components.push({
        field: fieldName,
        component: fieldDef.component,
        repeatable: fieldDef.repeatable || false,
      });
    }
  }
  
  return { relations, components };
}

/**
 * Identifica campos redundantes
 */
function identifyRedundantFields(schema, contentTypeName) {
  const redundancies = [];
  
  if (contentTypeName === 'Persona') {
    // Campos de nombre que podrían ser redundantes
    const nameFields = ['nombres', 'primer_apellido', 'segundo_apellido', 'nombre_apellidos', 'nombre_completo', 'iniciales'];
    const existingNameFields = nameFields.filter(f => schema.attributes[f]);
    
    if (existingNameFields.length > 2) {
      redundancies.push({
        type: 'multiple_name_fields',
        fields: existingNameFields,
        recommendation: 'Considerar consolidar campos de nombre. nombre_completo puede calcularse desde nombres, primer_apellido, segundo_apellido',
      });
    }
  }
  
  if (contentTypeName === 'Colegio') {
    // Verificar si hay campos que podrían ser calculados
    if (schema.attributes.region && schema.attributes.provincia && schema.attributes.comuna) {
      redundancies.push({
        type: 'geographic_redundancy',
        fields: ['region', 'provincia', 'comuna'],
        recommendation: 'Si comuna siempre tiene provincia y región, considerar derivar desde comuna',
      });
    }
  }
  
  return redundancies;
}

/**
 * Analiza un Content Type
 */
function analyzeContentType(contentType) {
  console.log(`\n📊 Analizando ${contentType.name}...`);
  
  const schema = readSchema(contentType.schemaPath);
  if (!schema) {
    console.warn(`⚠️  No se encontró el schema en ${contentType.schemaPath}`);
    return null;
  }
  
  const fields = extractFields(schema);
  console.log(`   Total de campos: ${fields.length}`);
  
  const analysis = {
    contentType: contentType.name,
    uid: contentType.uid,
    totalFields: fields.length,
    fields: [],
    relations: [],
    components: [],
    redundancies: [],
    unusedFields: [],
    lowUsageFields: [],
  };
  
  // Analizar relaciones y componentes
  const { relations, components } = analyzeRelations(schema);
  analysis.relations = relations;
  analysis.components = components;
  
  // Analizar cada campo
  for (const fieldName of fields) {
    const fieldDef = schema.attributes[fieldName];
    const usage = findFieldUsageInCode(fieldName, contentType.name.toLowerCase());
    
    const fieldAnalysis = {
      name: fieldName,
      type: fieldDef.type,
      required: fieldDef.required || false,
      unique: fieldDef.unique || false,
      usage: usage,
      isUsed: usage.totalMatches > 0,
      usageCount: usage.totalMatches,
    };
    
    analysis.fields.push(fieldAnalysis);
    
    if (!fieldAnalysis.isUsed && fieldDef.type !== 'relation' && fieldDef.type !== 'component') {
      analysis.unusedFields.push(fieldName);
    } else if (fieldAnalysis.usageCount < 3 && fieldDef.type !== 'relation' && fieldDef.type !== 'component') {
      analysis.lowUsageFields.push(fieldName);
    }
  }
  
  // Identificar redundancias
  analysis.redundancies = identifyRedundantFields(schema, contentType.name);
  
  return analysis;
}

/**
 * Genera reporte en consola
 */
function printReport(analyses) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 REPORTE DE ANÁLISIS DE CAMPOS');
  console.log('='.repeat(80));
  
  for (const analysis of analyses) {
    if (!analysis) continue;
    
    console.log(`\n## ${analysis.contentType}`);
    console.log(`   UID: ${analysis.uid}`);
    console.log(`   Total campos: ${analysis.totalFields}`);
    console.log(`   Relaciones: ${analysis.relations.length}`);
    console.log(`   Componentes: ${analysis.components.length}`);
    
    // Campos no utilizados
    if (analysis.unusedFields.length > 0) {
      console.log(`\n   ❌ CAMPOS NO UTILIZADOS (${analysis.unusedFields.length}):`);
      for (const field of analysis.unusedFields) {
        const fieldInfo = analysis.fields.find(f => f.name === field);
        console.log(`      - ${field} (${fieldInfo.type})`);
      }
    }
    
    // Campos con bajo uso
    if (analysis.lowUsageFields.length > 0) {
      console.log(`\n   ⚠️  CAMPOS CON BAJO USO (${analysis.lowUsageFields.length}):`);
      for (const field of analysis.lowUsageFields.slice(0, 10)) {
        const fieldInfo = analysis.fields.find(f => f.name === field);
        console.log(`      - ${field} (${fieldInfo.type}) - ${fieldInfo.usageCount} referencias`);
      }
      if (analysis.lowUsageFields.length > 10) {
        console.log(`      ... y ${analysis.lowUsageFields.length - 10} más`);
      }
    }
    
    // Redundancias
    if (analysis.redundancies.length > 0) {
      console.log(`\n   🔄 REDUNDANCIAS DETECTADAS (${analysis.redundancies.length}):`);
      for (const red of analysis.redundancies) {
        console.log(`      - ${red.type}: ${red.fields.join(', ')}`);
        console.log(`        💡 ${red.recommendation}`);
      }
    }
    
    // Relaciones
    if (analysis.relations.length > 0) {
      console.log(`\n   🔗 RELACIONES (${analysis.relations.length}):`);
      for (const rel of analysis.relations.slice(0, 5)) {
        console.log(`      - ${rel.field} → ${rel.target} (${rel.relation})`);
      }
      if (analysis.relations.length > 5) {
        console.log(`      ... y ${analysis.relations.length - 5} más`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMENDACIONES:');
  console.log('   1. Revisar campos no utilizados - pueden eliminarse si no son necesarios');
  console.log('   2. Consolidar campos redundantes - simplificar el modelo');
  console.log('   3. Validar relaciones - asegurar que todas son necesarias');
  console.log('   4. Considerar campos calculados - algunos campos pueden derivarse de otros');
  console.log('='.repeat(80) + '\n');
}

/**
 * Genera reporte en JSON
 */
function generateJSONReport(analyses, outputPath) {
  const report = {
    generatedAt: new Date().toISOString(),
    analyses: analyses.filter(a => a !== null),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✅ Reporte JSON generado en: ${outputPath}`);
}

/**
 * Función principal
 */
async function main() {
  console.log('🔍 Iniciando análisis de uso de campos...\n');
  
  const analyses = [];
  
  for (const contentType of CONTENT_TYPES) {
    const analysis = analyzeContentType(contentType);
    analyses.push(analysis);
  }
  
  // Generar reportes
  printReport(analyses);
  
  const jsonPath = path.join(projectRoot, 'scripts', 'field-usage-analysis.json');
  generateJSONReport(analyses, jsonPath);
  
  console.log('\n✨ Análisis completado!\n');
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

