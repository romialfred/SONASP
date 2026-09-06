import { origineAutorisee, reponseJson, reponsePrevol } from '../_shared/cors.ts';

export interface RenderDependencies {
  authenticate(token: string): Promise<boolean>;
  render(token: string, cardId: string): Promise<void>;
}
export function createAffiliationRenderHandler(deps: RenderDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);
    if (req.headers.has('Origin') && !origineAutorisee(req)) return reponseJson(req, { error: 'Origine non autorisée.' }, 403);
    if (req.method !== 'POST') return reponseJson(req, { error: 'Méthode non autorisée.' }, 405);
    const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || !await deps.authenticate(token)) return reponseJson(req, { error: 'Session non autorisée.' }, 401);
    if (Number(req.headers.get('Content-Length') || 0) > 1024) return reponseJson(req, { error: 'Requête trop volumineuse.' }, 413);
    const reader = req.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    if (reader) { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 1024) { await reader.cancel(); return reponseJson(req, { error: 'Requête trop volumineuse.' }, 413); } chunks.push(part.value);
    } }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const raw = new TextDecoder().decode(bytes);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return reponseJson(req, { error: 'Requête invalide.' }, 400); }
    if (!data || typeof data !== 'object' || Object.keys(data).length !== 1 || !('cardId' in data)
      || typeof data.cardId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.cardId)) {
      return reponseJson(req, { error: 'Référence de carte invalide.' }, 400);
    }
    try {
      await deps.render(token, data.cardId);
      return reponseJson(req, { success: true });
    } catch {
      // No sensitive data, JWT, Storage URL or internal exception is returned/logged.
      return reponseJson(req, { error: 'La génération n’a pas abouti. Vérifiez les droits, la photographie et la configuration du rendu, puis réessayez.' }, 422);
    }
  };
}
