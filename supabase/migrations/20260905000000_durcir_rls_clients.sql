-- Durcit les politiques RLS des clients export et de leurs comptes bancaires.
--
-- Constats :
--  * customers, customer_banks, customer_accounts_receivable exposaient des
--    politiques d'ECRITURE « USING(true) » / « WITH CHECK(true) » : tout compte
--    authentifie (mine, comptoir, collecteur...) pouvait creer/modifier/supprimer
--    un client export et ses coordonnees bancaires. customers portait en plus des
--    doublons (trois variantes INSERT/UPDATE, deux DELETE, quatre SELECT) et une
--    policy gouvernee referencant des roles inexistants (superadmin, sales_manager).
--  * Le registre de routes reserve la gestion des clients a l'agent SONASP
--    (management, compte sonasp, capacite SONASP_PREPARE).
--
-- Correctif : ecritures reservees a snp_est_agent_sonasp() (capacites sonasp.*
-- + AAL2), politiques dedupliquees, lecture conservee large (les clients sont
-- references par les ventes et listes lors de la creation d'une vente).
-- customer_accounts_receivable n'est jamais ecrit cote client (RPC serveur en
-- SECURITY DEFINER) : ses ecritures directes sont fermees a l'agent SONASP.
-- Migration additive, idempotente. Aucune fonction creee (registre RPC intact).

-- ============================== CUSTOMERS ==============================
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS authenticated_users_delete_customers ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can create customers" ON public.customers;
DROP POLICY IF EXISTS authenticated_users_insert_customers ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can update customers" ON public.customers;
DROP POLICY IF EXISTS authenticated_users_update_customers ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their customers" ON public.customers;
DROP POLICY IF EXISTS authenticated_users_select_customers ON public.customers;

CREATE POLICY snp_customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY snp_customers_insert_sonasp ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_customers_update_sonasp ON public.customers
  FOR UPDATE TO authenticated
  USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_customers_delete_sonasp ON public.customers
  FOR DELETE TO authenticated
  USING (public.snp_est_agent_sonasp());

-- ============================ CUSTOMER_BANKS ============================
DROP POLICY IF EXISTS "Authenticated users can delete customer banks" ON public.customer_banks;
DROP POLICY IF EXISTS "Authenticated users can insert customer banks" ON public.customer_banks;
DROP POLICY IF EXISTS "Authenticated users can update customer banks" ON public.customer_banks;
DROP POLICY IF EXISTS "Authenticated users can view all customer banks" ON public.customer_banks;
DROP POLICY IF EXISTS "Authenticated users can view customer banks" ON public.customer_banks;

CREATE POLICY snp_customer_banks_select ON public.customer_banks
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY snp_customer_banks_insert_sonasp ON public.customer_banks
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_customer_banks_update_sonasp ON public.customer_banks
  FOR UPDATE TO authenticated
  USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_customer_banks_delete_sonasp ON public.customer_banks
  FOR DELETE TO authenticated
  USING (public.snp_est_agent_sonasp());

-- ==================== CUSTOMER_ACCOUNTS_RECEIVABLE ====================
-- Ecritures directes fermees : la table est alimentee par les RPC serveur.
DROP POLICY IF EXISTS "Users can create accounts receivable" ON public.customer_accounts_receivable;
DROP POLICY IF EXISTS "Users can update accounts receivable" ON public.customer_accounts_receivable;

CREATE POLICY snp_customer_ar_insert_sonasp ON public.customer_accounts_receivable
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_est_agent_sonasp());
CREATE POLICY snp_customer_ar_update_sonasp ON public.customer_accounts_receivable
  FOR UPDATE TO authenticated
  USING (public.snp_est_agent_sonasp())
  WITH CHECK (public.snp_est_agent_sonasp());

-- ============================== POSTFLIGHT ==============================
DO $postflight$
DECLARE
  v_ouvertes int;
BEGIN
  SELECT count(*) INTO v_ouvertes
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('customers', 'customer_banks', 'customer_accounts_receivable')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    AND (coalesce(with_check, '') = 'true' OR coalesce(qual, '') = 'true');
  IF v_ouvertes > 0 THEN
    RAISE EXCEPTION 'Des politiques d''ecriture permissives subsistent sur les clients (%).', v_ouvertes;
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';
