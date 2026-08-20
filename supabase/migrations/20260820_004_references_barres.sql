-- ============================================================================
-- Références de barres : le code de la société qui les produit
--
-- Les dix barres enregistrées portaient les préfixes d'un autre exploitant :
-- HUMSMK (Komana, Mali), HUMDUG (Dugbe, Liberia), HUMSEM, HUMWAH, HUMSOC. Deux
-- défauts s'y ajoutaient : le préfixe ne correspondait pas toujours à la société
-- de la ligne — des barres de SEMAFO portaient le code d'une mine malienne — et
-- le générateur préfixait « HUM » à n'importe quel nom de société.
--
-- Chaque référence devient « <code société>-NNNN », numérotée par ordre
-- chronologique au sein de chaque société : SBM-0001, WGM-0001…
--
-- Aucune clé étrangère ne reprend `bar_reference` : la renumérotation ne casse
-- aucun lien. L'ancienne référence est conservée dans `notes`.
--
-- À exécuter après `20260820_003_auteurs_supprimes.sql` : sans lui, toute mise à
-- jour de `daily_production` échoue sur une clé d'auteur orpheline.
--
-- Retour arrière : aucun automatique ; les anciennes références restent lisibles
-- dans `notes` sous la mention « Ancienne référence : … ».
-- ============================================================================

UPDATE daily_production
SET notes = trim(both E'\n' from coalesce(notes, '') || E'\n' || 'Ancienne référence : ' || bar_reference)
WHERE bar_reference LIKE 'HUM%';

WITH numerotation AS (
  SELECT
    dp.id,
    upper(regexp_replace(coalesce(mc.code, mc.abbreviation, left(mc.name, 3)), '[^A-Za-z0-9]', '', 'g')) AS prefixe,
    row_number() OVER (PARTITION BY dp.mining_company_id ORDER BY dp.production_date, dp.created_at) AS rang
  FROM daily_production dp
  JOIN mining_companies mc ON mc.id = dp.mining_company_id
  WHERE dp.bar_reference LIKE 'HUM%'
)
UPDATE daily_production dp
SET bar_reference = n.prefixe || '-' || lpad(n.rang::text, 4, '0')
FROM numerotation n
WHERE n.id = dp.id;
