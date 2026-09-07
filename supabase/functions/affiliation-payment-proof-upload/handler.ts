import { origineAutorisee, reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { POLITIQUE_DOCUMENT_ARTISAN, validerUploadServeur } from '../_shared/secure-upload.ts';

export type PaymentProofFile = { bytes: Uint8Array; name: string; mime: 'application/pdf' | 'image/png' | 'image/jpeg'; extension: 'pdf' | 'png' | 'jpg' };
export interface ProofUploadDependencies {
  authenticate(token: string): Promise<boolean>;
  save(token: string, duesId: string, receiptId: string, file: PaymentProofFile): Promise<unknown>;
}
const MAX_FILE = 5 * 1024 * 1024;
const MAX_REQUEST = MAX_FILE + 8192;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createAffiliationProofHandler(deps: ProofUploadDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);
    if (req.headers.has('Origin') && !origineAutorisee(req)) return reponseJson(req, { error: 'Origine non autorisée.' }, 403);
    if (req.method !== 'POST') return reponseJson(req, { error: 'Méthode non autorisée.' }, 405);
    const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    try {
      if (!token || !await deps.authenticate(token)) return reponseJson(req, { error: 'Session non autorisée.' }, 401);
      if (!req.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return reponseJson(req, { error: 'Fichier attendu.' }, 400);
      if (Number(req.headers.get('Content-Length') || 0) > MAX_REQUEST) return reponseJson(req, { error: 'Fichier trop volumineux.' }, 413);
      const chunks: Uint8Array[] = []; let total = 0;
      const reader = req.body?.getReader();
      if (!reader) return reponseJson(req, { error: 'Fichier attendu.' }, 400);
      while (true) {
        const part = await reader.read(); if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_REQUEST) { await reader.cancel(); return reponseJson(req, { error: 'Fichier trop volumineux.' }, 413); }
        chunks.push(part.value);
      }
      const raw = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
      let form: FormData;
      try { form = await new Response(raw, { headers: { 'Content-Type': req.headers.get('Content-Type')! } }).formData(); }
      catch { return reponseJson(req, { error: 'Dépôt invalide.' }, 400); }
      const duesId = form.get('duesId'), receiptId = form.get('receiptId'), file = form.get('file');
      if ([...form.keys()].sort().join(',') !== 'duesId,file,receiptId' || typeof duesId !== 'string' || !uuid.test(duesId)
        || typeof receiptId !== 'string' || !uuid.test(receiptId) || !(file instanceof File))
        return reponseJson(req, { error: 'Référence de paiement ou fichier invalide.' }, 400);
      if (!file.size || file.size > MAX_FILE) return reponseJson(req, { error: 'Fichier de 5 Mo maximum requis.' }, 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let validated;
      try { validated = validerUploadServeur({ fileName: file.name, declaredMimeType: file.type, bytes }, POLITIQUE_DOCUMENT_ARTISAN); }
      catch { return reponseJson(req, { error: 'Le contenu du fichier doit être un PDF, JPG ou PNG valide.' }, 400); }
      const mime = validated.mimeType as PaymentProofFile['mime'];
      const proof = await deps.save(token, duesId, receiptId, { bytes, name: validated.safeFileName, mime, extension: mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg' });
      return reponseJson(req, { proof });
    } catch {
      return reponseJson(req, { error: 'Le dépôt a été refusé. Vérifiez vos droits et le dossier, puis réessayez.' }, 422);
    }
  };
}
