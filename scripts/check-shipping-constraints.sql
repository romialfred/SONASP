-- Vérifier toutes les contraintes sur shipping_preparations
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'shipping_preparations'::regclass
ORDER BY conname;

-- Vérifier spécifiquement la colonne status
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';
