-- ============================================
-- VÉRIFICATION ENUM shipping_preparation_status
-- ============================================

-- Afficher toutes les valeurs de l'ENUM
SELECT
    'Valeurs actuelles de shipping_preparation_status:' as info;

SELECT
    enumlabel as valeur,
    enumsortorder as ordre
FROM pg_enum
WHERE enumtypid = 'shipping_preparation_status'::regtype
ORDER BY enumsortorder;

-- Vérifier le DEFAULT de la colonne status
SELECT
    'DEFAULT de la colonne shipping_preparations.status:' as info;

SELECT
    column_name,
    column_default,
    data_type
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';

-- Compter les enregistrements par statut
SELECT
    'Répartition des statuts existants:' as info;

SELECT
    status,
    COUNT(*) as nombre
FROM shipping_preparations
GROUP BY status
ORDER BY nombre DESC;
