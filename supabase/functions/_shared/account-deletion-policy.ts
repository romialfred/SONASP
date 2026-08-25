/**
 * Tables dont les lignes décrivent le compte, sa sécurité ou sa traçabilité.
 * Elles ne prouvent jamais qu'une opération métier a été réalisée.
 *
 * Les journaux doivent être conservés ou anonymisés par leurs contraintes de
 * base ; ils ne peuvent pas transformer à eux seuls un compte vierge en
 * compte métier non supprimable.
 */
export const ACCOUNT_TECHNICAL_TABLES = new Set([
  'audit_logs',
  'audit_trail',
  'security_events',
  'snp_comptes_audit',
  'password_history',
  'user_2fa_setup',
  'user_acceptance_logs',
  'user_activation_tokens',
  'user_activity_logs',
  'user_capabilities',
  'user_capability_overrides',
  'user_invitations',
  'user_login_history',
  'user_permissions',
  'user_sessions',
  'user_site_assignments',
  'artisanal_site_assignments',
  'snp_user_capabilities',
  'snp_user_organization_memberships',
]);

export function isAccountTechnicalReference(table: string, column: string): boolean {
  if (ACCOUNT_TECHNICAL_TABLES.has(table)) return true;
  return table === 'user_profiles'
    && ['id', 'mining_company_id', 'mfa_reset_by'].includes(column);
}

const ACCOUNT_ACTIVITY_COLUMNS = new Set([
  'user_id', 'created_by', 'updated_by', 'uploaded_by', 'approved_by',
  'shipped_by', 'received_by', 'added_by', 'changed_by', 'actor_id',
  'acteur_id', 'assigned_by', 'assigned_to', 'granted_by', 'reviewed_by',
  'author_id', 'handled_by', 'verified_by', 'processed_by', 'stocked_by',
  'completed_by', 'cancelled_by', 'failed_by', 'executed_by', 'rejected_by',
  'converted_by', 'reconciled_by', 'issued_by', 'paid_by', 'submitted_by',
  'reversement_started_by', 'reversed_by', 'validee_par', 'valide_par',
  'repondu_par', 'declenche_par', 'prepare_par', 'soumis_par', 'execute_par',
  'rapproche_par', 'ajoute_par', 'verifiee_par', 'affecte_par', 'annulee_par',
  'autorisee_par', 'envoye_par', 'released_by', 'requested_by', 'approuve_par',
  'supprime_par', 'enregistre_par', 'retenue_par', 'emise_par',
  'imputation_decidee_par', 'mfa_reset_by', 'responsable_id',
  'responsable_traitement', 'gestionnaire_id',
]);

export function isKnownAccountActivityColumn(column: string): boolean {
  return ACCOUNT_ACTIVITY_COLUMNS.has(column);
}

export function isSecurityOnlyPurchaseAudit(row: { objet?: unknown; action?: unknown }): boolean {
  return row.objet === 'user_profiles'
    && [
      'compte_cree',
      'compte_modifie',
      'compte_desactive',
      'compte_reactive',
      'mfa_enrole',
      'mfa_reinitialise',
      'mot_de_passe_modifie',
    ].includes(String(row.action ?? ''));
}
