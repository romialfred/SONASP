-- ============================================================================
-- SONASP — Rôle « Approbateur des ventes »
-- Droit accordé à certains utilisateurs : approuver les ventes d'or artisanal
-- et les ventes à l'international avant génération de facture / émission du paiement.
-- Additif et non destructif.
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_sales_approver boolean NOT NULL DEFAULT false;
