/*
  Transition production - compatibilite de l'enum fret.

  La base historique expose encore les valeurs waiting_for_shipping et
  shipped_for_refinery. Le lot 4F attend en plus les deux etats douaniers
  ci-dessous. Les ajouter dans une migration distincte garantit que PostgreSQL
  valide et publie les nouvelles valeurs avant que le lot suivant les utilise.

  Cette migration est additive, idempotente et compatible avec l'ancien
  frontend. Les anciennes valeurs ne sont volontairement ni renommees ni
  supprimees pendant la phase expand.
*/

ALTER TYPE public.freight_customs_status
  ADD VALUE IF NOT EXISTS 'customs_pending' BEFORE 'ready_for_transport';

ALTER TYPE public.freight_customs_status
  ADD VALUE IF NOT EXISTS 'customs_approved' BEFORE 'ready_for_transport';

-- La production historique ne contient pas ce journal, alors que le lot 2M
-- en depend pour garantir la tracabilite des activations/desactivations.
-- Le creer ici reste purement additif et n'ouvre aucun droit navigateur.
CREATE TABLE IF NOT EXISTS public.snp_comptes_audit (
  uid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acteur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cible_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('activation', 'desactivation')),
  ancien_etat boolean NOT NULL,
  nouvel_etat boolean NOT NULL,
  motif text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snp_comptes_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_comptes_audit
  FROM PUBLIC, anon, authenticated, service_role;
