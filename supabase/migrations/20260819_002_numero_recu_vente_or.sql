-- ============================================================================
-- Numérotation des reçus de vente d'or artisanale
--
-- Nouveau format : VE-OR-AAAA-NNNNN
--   VE    : vente
--   OR    : or
--   AAAA  : année d'émission
--   NNNNN : compteur incrémental propre à l'année
--
-- C'est ce numéro qui identifie la vente jusqu'au paiement, en passant par la
-- facture.
--
-- L'ancien format `VENTE/OR/2025/12/0002` comportait des barres obliques, peu
-- commodes en URL, en nom de fichier et dans un export CSV.
--
-- La numérotation est désormais tenue par l'application
-- (`src/services/venteRecuNumberService.ts`). La fonction ci-dessous reste
-- définie pour les insertions faites hors application — console SQL, import —
-- et produit exactement le même format.
--
-- Retour arrière :
--   1. Restaurer l'ancienne `generate_numero_recu_vente_or()`.
--   2. Rejouer la conversion en sens inverse :
--        UPDATE snp_artisan_ventes_or
--        SET numero_recu = 'VENTE/OR/' || substr(numero_recu, 7, 4) || '/12/' ||
--                          lpad(ltrim(substr(numero_recu, 12), '0'), 4, '0')
--        WHERE numero_recu ~ '^VE-OR-[0-9]{4}-[0-9]{5}$';
--      Le mois n'est pas restituable : le compteur est devenu annuel.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_recu_vente_or()
RETURNS text AS $$
DECLARE
  prefixe text;
  prochain int;
BEGIN
  prefixe := 'VE-OR-' || to_char(CURRENT_DATE, 'YYYY');

  -- Le compteur est propre au préfixe : chaque année repart de 00001.
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_recu, '^.*-', ''), '')::int), 0) + 1
  INTO prochain
  FROM snp_artisan_ventes_or
  WHERE numero_recu LIKE prefixe || '-%';

  RETURN prefixe || '-' || LPAD(prochain::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Conversion des numéros déjà attribués.
--
-- Migration de données : elle réécrit des identifiants de pièces comptables.
-- Elle est idempotente — seules les lignes encore au format hérité sont
-- touchées — et la requête de retour arrière figure en tête de fichier.
-- ----------------------------------------------------------------------------
UPDATE snp_artisan_ventes_or
SET numero_recu =
  'VE-OR-'
  || split_part(numero_recu, '/', 3)
  || '-'
  || lpad(split_part(numero_recu, '/', 5), 5, '0')
WHERE numero_recu ~ '^VENTE/OR/[0-9]{4}/[0-9]{1,2}/[0-9]+$';
