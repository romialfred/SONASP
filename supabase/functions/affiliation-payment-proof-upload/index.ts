import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { createAffiliationProofHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const forUser = (token: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'affiliation-payment-proofs';

Deno.serve(createAffiliationProofHandler({
  async authenticate(token) {
    const client = forUser(token);
    const identity = await client.auth.getUser(token);
    if (identity.error || !identity.data.user || niveauAssurance(token) !== 'aal2') return false;
    const session = await client.rpc('snp_session_signaler_activite');
    return !session.error && session.data?.is_active === true;
  },
  async save(token, duesId, receiptId, file) {
    const client = forUser(token);
    const access = await client.rpc('snp_adhesion_preuve_allowed', { p_droit: duesId });
    if (access.error || !access.data?.artisan_id || !access.data.actor_id) throw new Error('Accès refusé');
    const path = `${access.data.artisan_id}/${duesId}/${receiptId}.${file.extension}`;
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(file.bytes).buffer))].map(v => v.toString(16).padStart(2,'0')).join('');
    const row = { paiement_id: receiptId, droit_id: duesId, artisan_id: access.data.artisan_id, path,
      file_name: file.name, mime_type: file.mime, file_size: file.bytes.length, sha256, uploaded_by: access.data.actor_id };
    const reusable = (r: Record<string, unknown> | null) => !!r && r.path === path && r.sha256 === sha256 && r.uploaded_by === row.uploaded_by && r.droit_id === duesId;
    const proof = { path, file_name: row.file_name, mime_type: row.mime_type, file_size: row.file_size, sha256 };
    const existing = await service.from('snp_adhesion_preuves').select('*').eq('paiement_id', receiptId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) { if (reusable(existing.data)) return proof; throw new Error('Référence déjà utilisée'); }
    const upload = await service.storage.from(bucket).upload(path, file.bytes, { contentType: file.mime, upsert: false });
    if (upload.error) {
      const raced = await service.from('snp_adhesion_preuves').select('*').eq('paiement_id', receiptId).maybeSingle();
      if (!raced.error && reusable(raced.data)) return proof;
      throw upload.error;
    }
    const saved = await service.from('snp_adhesion_preuves').insert(row);
    if (!saved.error) return proof;
    // An interrupted response may follow a successful transaction: never remove a referenced proof.
    const persisted = await service.from('snp_adhesion_preuves').select('*').eq('paiement_id', receiptId).maybeSingle();
    if (!persisted.error && reusable(persisted.data)) return proof;
    if (!persisted.error && !persisted.data) await service.storage.from(bucket).remove([path]);
    throw saved.error;
  },
}));
