# Personas · Migración `nombre_apellidos` & `iniciales`

Agregar las nuevas columnas al modelo `persona` y recalcular los valores en producción.

## PostgreSQL

```sql
ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "nombre_apellidos" varchar(255);
ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "iniciales" varchar(10);

UPDATE "personas"
SET "nombre_apellidos" = trim(concat_ws(' ',
  NULLIF(trim("nombres"), ''),
  NULLIF(trim("primer_apellido"), ''),
  NULLIF(trim("segundo_apellido"), '')
));

UPDATE "personas"
SET "nombre_completo" = trim(concat_ws(' ',
  NULLIF(trim("nombres"), ''),
  NULLIF(trim("primer_apellido"), '')
));

UPDATE "personas"
SET "iniciales" = CASE
  WHEN coalesce(trim("nombres"), '') = '' AND coalesce(trim("primer_apellido"), '') = '' THEN NULL
  ELSE upper(substring(trim("nombres") FROM 1 FOR 1)) || upper(substring(trim("primer_apellido") FROM 1 FOR 1))
END;
```

## MySQL / MariaDB

```sql
ALTER TABLE `personas` ADD COLUMN `nombre_apellidos` varchar(255) NULL;
ALTER TABLE `personas` ADD COLUMN `iniciales` varchar(10) NULL;

UPDATE `personas`
SET `nombre_apellidos` = TRIM(CONCAT_WS(' ',
  NULLIF(TRIM(`nombres`), ''),
  NULLIF(TRIM(`primer_apellido`), ''),
  NULLIF(TRIM(`segundo_apellido`), '')
));

UPDATE `personas`
SET `nombre_completo` = TRIM(CONCAT_WS(' ',
  NULLIF(TRIM(`nombres`), ''),
  NULLIF(TRIM(`primer_apellido`), '')
));

UPDATE `personas`
SET `iniciales` = CASE
  WHEN COALESCE(TRIM(`nombres`), '') = '' AND COALESCE(TRIM(`primer_apellido`), '') = '' THEN NULL
  ELSE CONCAT(
    UPPER(LEFT(TRIM(`nombres`), 1)),
    UPPER(LEFT(TRIM(`primer_apellido`), 1))
  )
END;
```

> Ejecutar solo la sección que corresponda al motor usado en el entorno. Repetir el proceso en ambientes adicionales (staging/prod) tras desplegar el cambio de schema.
