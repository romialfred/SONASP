-- R-25 — La contrainte héritée payments_status_check (pending/approved/
-- rejected) contredit le jeu canonique du lot 4H (pending/processing/
-- approved/rejected/cancelled/failed) : le lot 4H a ajouté sa contrainte
-- NOT VALID sans retirer l'ancienne, et toute exécution de paiement
-- (statut 'processing') était donc refusée par la base. On retire
-- l'obsolète et on valide la canonique, désormais seule source de vérité.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_4h_canonical_status_check;

DO $post$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass AND conname='payments_status_check'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte obsolète est encore là.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.payments'::regclass
      AND conname='payments_4h_canonical_status_check' AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte canonique n''est pas validée.';
  END IF;
END
$post$;
