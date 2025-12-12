-- Analyser l'enum sale_status et trouver TOUTES les valeurs valides
SELECT 
  enumlabel as valid_status_value,
  enumsortorder as sort_order
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;
