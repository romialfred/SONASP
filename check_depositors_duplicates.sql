-- Vérifier les doublons actuels dans depositors
SELECT
  d1.id as id1,
  d2.id as id2,
  d1.full_name,
  d1.category,
  mc.name as company_name,
  d1.mining_company_id,
  d1.created_at as created_at_1,
  d2.created_at as created_at_2
FROM depositors d1
INNER JOIN depositors d2
  ON d1.mining_company_id = d2.mining_company_id
  AND d1.category = d2.category
  AND LOWER(TRIM(d1.full_name)) = LOWER(TRIM(d2.full_name))
  AND d1.id < d2.id
LEFT JOIN mining_companies mc ON d1.mining_company_id = mc.id
WHERE d1.is_active = true
  AND d2.is_active = true
ORDER BY d1.full_name, d1.created_at;
