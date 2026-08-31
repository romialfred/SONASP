-- Vérification indépendante après COMMIT, aucun secret Auth n'est sélectionné.
SELECT 'auth_account' AS check_name,count(*) AS remaining FROM auth.users
WHERE id='c7570144-0075-4cb0-8a59-4713c1ebe07f' OR lower(email)='otingueri@gmail.com'
UNION ALL SELECT 'profile',count(*) FROM public.user_profiles
WHERE id='c7570144-0075-4cb0-8a59-4713c1ebe07f' OR lower(email)='otingueri@gmail.com'
UNION ALL SELECT 'module_permissions',count(*) FROM public.user_permissions WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'capabilities',count(*) FROM public.snp_user_capabilities WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'application_sessions',count(*) FROM public.user_sessions WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'auth_sessions',count(*) FROM auth.sessions WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'identities',count(*) FROM auth.identities WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'mfa',count(*) FROM auth.mfa_factors WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'refresh_tokens',count(*) FROM auth.refresh_tokens WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'auth_flow',count(*) FROM auth.flow_state WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'one_time_tokens',count(*) FROM auth.one_time_tokens WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'oauth_consents',count(*) FROM auth.oauth_consents WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'oauth_authorizations',count(*) FROM auth.oauth_authorizations WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'webauthn_challenges',count(*) FROM auth.webauthn_challenges WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'webauthn_credentials',count(*) FROM auth.webauthn_credentials WHERE user_id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
UNION ALL SELECT 'deletion_audit_expected_one',count(*) FROM public.audit_trail
WHERE record_id='c7570144-0075-4cb0-8a59-4713c1ebe07f' AND action='account_deleted'
AND details->>'operation_id'='a2988a04-1f35-4b98-b583-28ac9a08c118';
