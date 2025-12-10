/*
  Vérification des valeurs ENUM (SANS array_agg)

  Cette version utilise string_agg au lieu de array_agg
*/

-- Vérifier les ENUM de shipping et production
SELECT
    typname as enum_name,
    string_agg(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('production_status_v2', 'shipping_status_v2', 'sales_status')
GROUP BY typname
ORDER BY typname;

-- Détails ligne par ligne
SELECT
    t.typname as enum_name,
    e.enumlabel as value,
    e.enumsortorder as position
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('production_status_v2', 'shipping_status_v2', 'sales_status')
ORDER BY t.typname, e.enumsortorder;
