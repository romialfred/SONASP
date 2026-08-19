-- ============================================================================
-- Numérotation des cartes professionnelles d'artisan minier
--
-- Nouveau format : BF-AM-AAAA-XZTM-NNNN
--   BF   : Burkina Faso
--   AM   : artisan minier
--   AAAA : année d'émission
--   XZTM : empreinte de l'instant — X le jour, Z le mois, T l'heure, M la minute,
--          chacun sur un seul caractère
--   NNNN : compteur incrémental propre à un XZTM donné
--
-- L'ancien format `SONASP/AM/2025/000063` comportait des barres obliques (peu
-- commodes en URL ou en nom de fichier) et un compteur global à l'année.
--
-- Migration additive : les numéros déjà attribués ne sont pas réécrits.
--
-- Retour arrière :
--   Restaurer l'ancienne fonction `generate_numero_carte()` telle que définie dans
--   20251226120554_26122025_01_artisan_minier_migration.sql. Aucune donnée n'est
--   modifiée par cette migration.
-- ============================================================================

-- Jour, mois et heure tiennent dans 36 symboles ; la minute, qui va jusqu'à 59,
-- utilise un alphabet de 60 caractères d'où `l` et `o` sont écartés car ils se
-- confondent avec `1` et `0` sur une carte imprimée.
CREATE OR REPLACE FUNCTION snp_encoder_instant_carte(instant timestamptz)
RETURNS text AS $$
DECLARE
  alphabet36 text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  alphabet60 text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
BEGIN
  RETURN
    substr(alphabet36, EXTRACT(DAY FROM instant)::int + 1, 1) ||
    substr(alphabet36, EXTRACT(MONTH FROM instant)::int + 1, 1) ||
    substr(alphabet36, EXTRACT(HOUR FROM instant)::int + 1, 1) ||
    substr(alphabet60, EXTRACT(MINUTE FROM instant)::int + 1, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION generate_numero_carte()
RETURNS TRIGGER AS $$
DECLARE
  instant timestamptz := CURRENT_TIMESTAMP;
  prefixe text;
  prochain int;
BEGIN
  prefixe := 'BF-AM-' || EXTRACT(YEAR FROM instant)::text || '-' || snp_encoder_instant_carte(instant);

  -- Le compteur est propre au préfixe : deux cartes émises à des minutes
  -- différentes repartent chacune de 0001.
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_carte, '^.*-', ''), '')::int), 0) + 1
  INTO prochain
  FROM SNP_artisans_miniers
  WHERE numero_carte LIKE prefixe || '-%';

  NEW.numero_carte := prefixe || '-' || LPAD(prochain::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Le déclencheur reste conditionné à l'absence de numéro : l'application peut
-- frapper le sien, ce qu'elle fait désormais.
DROP TRIGGER IF EXISTS trigger_generate_numero_carte ON SNP_artisans_miniers;
CREATE TRIGGER trigger_generate_numero_carte
  BEFORE INSERT ON SNP_artisans_miniers
  FOR EACH ROW
  WHEN (NEW.numero_carte IS NULL)
  EXECUTE FUNCTION generate_numero_carte();
