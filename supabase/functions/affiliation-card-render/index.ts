import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createAffiliationRenderHandler } from './handler.ts';
import { generateAffiliationFiles } from './render-files.ts';
import { niveauAssurance } from '../_shared/assurance.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const forUser = (token: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))].map(v => v.toString(16).padStart(2, '0')).join('');

/** Only same-project Storage paths, never user-provided HTTP resources (SSRF). */
function photoObject(reference: string, artisanId: string): { bucket: string; path: string } {
  let value = reference;
  if (/^https?:/.test(value)) {
    const parsed = new URL(value);
    if (parsed.origin !== new URL(url).origin) throw new Error('Photo externe interdite');
    value = decodeURIComponent(parsed.pathname.replace(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\//, ''));
  }
  const bucket = value.startsWith('artisan-dossiers/') ? 'artisan-dossiers' : 'artisan-documents';
  const path = value.startsWith(bucket + '/') ? value.slice(bucket.length + 1) : value;
  if (!path.startsWith(artisanId + '/') || path.split('/').some(v => !v || v === '..' || v === '.') || /[?\\#]/.test(path)) throw new Error('Photo hors dossier');
  return { bucket, path };
}
Deno.serve(createAffiliationRenderHandler({
  async authenticate(token) {
    if (niveauAssurance(token) !== 'aal2') return false;
    const client = forUser(token);
    const [identity, session] = await Promise.all([client.auth.getUser(token), client.rpc('snp_session_signaler_activite')]);
    return !identity.error && Boolean(identity.data.user) && !session.error && session.data?.is_active === true;
  },
  async render(token, cardId) {
    const client = forUser(token);
    const claim = await client.rpc('snp_claim_affiliation_render', { p_carte: cardId });
    if (claim.error || !claim.data) throw new Error('Rendu non autorisé');
    if (claim.data.ready) return;
    const { card, lease } = claim.data;
    const saved: string[] = [];
    try {
      const source = card.portrait_path ? { bucket: 'affiliation-cards', path: card.portrait_path } : photoObject(card.snapshot.photo_reference, card.artisan_id);
      // The caller's RLS must authorize the portrait as well as the card.
      const photograph = await (card.portrait_path ? service : client).storage.from(source.bucket).download(source.path);
      if (photograph.error || !photograph.data || photograph.data.size > 5242880 || !['image/png', 'image/jpeg'].includes(photograph.data.type)) throw new Error('Photographie indisponible');
      const photographBytes = new Uint8Array(await photograph.data.arrayBuffer());
      const generated = await generateAffiliationFiles(card, photographBytes, photograph.data.type, Deno.env.get('AFFILIATION_PUBLIC_ORIGIN') || '');
      const files: Record<string, { path: string; sha256: string }> = {};
      for (const [face, bytes] of Object.entries(generated)) {
        const path = `${card.artisan_id}/${card.id}/v${card.version}-r${card.render_revision}/${lease}/${face}.${face === 'pdf' ? 'pdf' : 'png'}`;
        const result = await service.storage.from('affiliation-cards').upload(path, bytes, { contentType: face === 'pdf' ? 'application/pdf' : 'image/png', upsert: false });
        if (result.error) throw new Error('Stockage du rendu indisponible');
        saved.push(path); files[face] = { path, sha256: await digest(bytes) };
      }
      const complete = await service.rpc('snp_complete_affiliation_render', { p_carte: cardId, p_lease: lease, p_revision: card.render_revision, p_files: files });
      if (complete.error) throw new Error('Confirmation du rendu refusée');
    } catch (error) {
      // A network timeout may occur after commit: never remove referenced files.
      const persisted = await service.from('snp_cartes_professionnelles').select('recto_path,verso_path,pdf_path,portrait_path').eq('id', cardId).single();
      if (!persisted.error && persisted.data && saved.some(path => Object.values(persisted.data).includes(path))) return;
      if (!persisted.error && saved.length) await service.storage.from('affiliation-cards').remove(saved);
      await service.rpc('snp_complete_affiliation_render', { p_carte: cardId, p_lease: lease, p_revision: card.render_revision, p_files: null });
      throw error;
    }
  },
}));
