-- R-25 — Avances partielles : preuve bancaire par versement.
--
-- Le contrôle 2L d'approbation exigeait, en plus du rattachement de la
-- preuve AU PAIEMENT (proof.payment_id = NEW.id, NEW.proof_url =
-- proof.file_path, objet Storage 'payment-proofs' aux métadonnées
-- concordantes : sha256, taille, MIME, payment_id, idempotency_key,
-- uploaded_by), que sales.payment_proof_url égale le chemin de la preuve.
-- Cette égalité de niveau VENTE est un vestige mono-paiement : une vente
-- ne peut pointer qu'une preuve à la fois, donc dès deux versements
-- partiels (avance du jour de l'expédition puis solde), l'approbation du
-- second versement était structurellement impossible — démontré en
-- transaction annulée le 27/08/2026 (approbation 1 ok, approbation 2
-- refusée « metadata-backed »).
--
-- On retire UNIQUEMENT cette égalité de niveau vente. Le lien par
-- versement et la concordance des métadonnées Storage restent entiers ;
-- sales.payment_proof_url demeure une commodité d'affichage (dernière
-- preuve posée par le gateway), plus un invariant d'approbation.
-- Migration rejouable : ancre stricte, saut si déjà appliquée.

DO $do$
DECLARE
  v_def text;
  v_ancre text := E'      AND s.payment_proof_url = proof.file_path\n';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_2l_require_private_proof_on_approval';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'snp_2l_require_private_proof_on_approval introuvable.';
  END IF;

  IF position('s.payment_proof_url' IN v_def) = 0 THEN
    RAISE NOTICE 'Déjà appliquée : rien à faire.';
    RETURN;
  END IF;

  IF (length(v_def) - length(replace(v_def, v_ancre, ''))) / length(v_ancre) <> 1 THEN
    RAISE EXCEPTION 'Ancre absente ou multiple : correctif à reprendre.';
  END IF;

  -- Les garanties par versement doivent être présentes avant de retirer
  -- l'égalité de niveau vente.
  IF position('proof.payment_id = NEW.id' IN v_def) = 0
     OR position('NEW.proof_url = proof.file_path' IN v_def) = 0
     OR position('snp_2l_payment_proof_object_matches' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Garanties par versement introuvables : correctif à reprendre.';
  END IF;

  v_def := replace(v_def, v_ancre, '');
  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_2l_require_private_proof_on_approval';
  IF position('s.payment_proof_url' IN v_def) > 0
     OR position('proof.payment_id = NEW.id' IN v_def) = 0
     OR position('snp_2l_payment_proof_object_matches' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Postflight en échec.';
  END IF;
END
$do$;
