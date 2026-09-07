import { organization } from './auth';
export const simulation = { uploadError: false, readError: false, removeError: false, saveError: false, dataError: false, dataDelay: false, emptySites: false, calls: [] as string[], objects: new Map<string, string>() };
const signal = (action: string) => { simulation.calls.push(action); window.dispatchEvent(new Event('qa-log')); };
const denied = () => { throw new Error('Transport réel interdit dans ce banc.'); };
const pause = () => new Promise(resolve => setTimeout(resolve, 300));
function from(table: string) {
  let single = false;
  const chain: any = new Proxy({}, { get(_target, key) {
    if (key === 'then') {
      const data = table === 'snp_organizations' ? (single ? organization : [organization]) : (single ? null : []);
      const promise = Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
      return promise.then.bind(promise);
    }
    if (['insert', 'update', 'upsert', 'delete'].includes(String(key))) return denied;
    return () => { if (key === 'single' || key === 'maybeSingle') single = true; return chain; };
  } }); return chain;
}
export const supabase = { from, rpc: denied, functions: { invoke: denied },
  storage: { from: () => ({
    upload: async (path: string, blob: Blob) => { await pause(); signal('Dépôt simulé : ' + (simulation.uploadError ? 'refus' : 'réussi en mémoire'));
      if (simulation.uploadError) return { data: null, error: new Error('Refus Storage simulé') };
      simulation.objects.set(path, URL.createObjectURL(blob)); return { data: { path }, error: null };
    },
    createSignedUrl: async (path: string) => { await pause(); signal('Lecture simulée : ' + (simulation.readError && path.endsWith('b.jpg') ? 'refus' : 'autorisée'));
      if (simulation.readError && path.endsWith('b.jpg')) return { data: null, error: new Error('Refus lecture simulé') };
      return { data: { signedUrl: simulation.objects.get(path) || '/login-gold-background.webp' }, error: null };
    },
    remove: async (paths: string[]) => { await pause(); signal('Retrait simulé : ' + (simulation.removeError ? 'refus' : 'réussi en mémoire'));
      if (simulation.removeError) return { data: null, error: new Error('Refus retrait simulé') };
      paths.forEach(path => { const url = simulation.objects.get(path); if (url) URL.revokeObjectURL(url); simulation.objects.delete(path); }); return { data: paths, error: null };
    },
  }) }, auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }) },
};
export { signal };
