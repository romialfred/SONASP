import { Archive, Edit3, FilePlus2, Save } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PublicationStatus = 'draft' | 'published' | 'archived';
type Publication = {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  image_url: string | null;
  document_url: string | null;
  status: PublicationStatus;
  published_at: string | null;
  updated_at: string;
};

type PublicationDraft = Omit<Publication, 'id' | 'updated_at'>;

const emptyDraft = (): PublicationDraft => ({
  slug: '', category: 'communique', title: '', summary: '', content: '', image_url: null,
  document_url: null, status: 'draft', published_at: null,
});

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120);
}

export default function PublicationsAdminPage() {
  const [items, setItems] = useState<Publication[]>([]);
  const [draft, setDraft] = useState<PublicationDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('publications').select('*').order('updated_at', { ascending: false });
    setLoading(false);
    if (error) {
      setMessage('Les publications ne peuvent pas être chargées. Vérifiez que la migration de la vitrine est appliquée.');
      return;
    }
    setItems((data ?? []) as Publication[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = (field: keyof PublicationDraft, value: string | null) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const edit = (item: Publication) => {
    const { id, updated_at, ...nextDraft } = item;
    void id;
    void updated_at;
    setDraft(nextDraft);
    setEditingId(item.id);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const payload = {
      ...draft,
      slug: draft.slug || slugify(draft.title),
      image_url: draft.image_url || null,
      document_url: draft.document_url || null,
      published_at: draft.status === 'published' ? draft.published_at || new Date().toISOString() : null,
    };
    if (payload.title.trim().length < 5 || payload.summary.trim().length < 20 || !payload.slug) {
      setMessage('Renseignez un titre, un identifiant d’URL et un résumé suffisamment détaillé.');
      return;
    }
    const query = editingId
      ? supabase.from('publications').update(payload).eq('id', editingId)
      : supabase.from('publications').insert(payload);
    const { error } = await query;
    if (error) {
      setMessage('La publication n’a pas pu être enregistrée.');
      return;
    }
    setMessage('Publication enregistrée.');
    setDraft(emptyDraft());
    setEditingId(null);
    await load();
  };

  const archive = async (id: string) => {
    const { error } = await supabase.from('publications').update({ status: 'archived' }).eq('id', id);
    setMessage(error ? 'L’archivage a échoué.' : 'Publication archivée.');
    if (!error) await load();
  };

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Vitrine institutionnelle</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">Actualités et publications</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Rédigez, publiez et archivez les contenus visibles sur les routes publiques.</p></div>
        <button type="button" onClick={() => { setDraft(emptyDraft()); setEditingId(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><FilePlus2 className="h-4 w-4" />Nouvelle publication</button>
      </header>

      <form onSubmit={save} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <div className="lg:col-span-2"><h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Modifier la publication' : 'Créer une publication'}</h2></div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">Titre<input value={draft.title} onChange={(e) => { update('title', e.target.value); if (!editingId) update('slug', slugify(e.target.value)); }} className="min-h-11 rounded-md border border-slate-300 px-3" required /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">Identifiant d’URL<input value={draft.slug} onChange={(e) => update('slug', slugify(e.target.value))} className="min-h-11 rounded-md border border-slate-300 px-3" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">Catégorie<select value={draft.category} onChange={(e) => update('category', e.target.value)} className="min-h-11 rounded-md border border-slate-300 px-3"><option value="communique">Communiqué</option><option value="information-operationnelle">Information opérationnelle</option><option value="avis-mines">Avis aux mines</option><option value="procedure">Procédure</option><option value="reglementation">Réglementation</option><option value="guide">Guide</option><option value="calendrier">Calendrier</option><option value="interruption">Interruption</option></select></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">Statut<select value={draft.status} onChange={(e) => update('status', e.target.value as PublicationStatus)} className="min-h-11 rounded-md border border-slate-300 px-3"><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">Résumé<textarea value={draft.summary} onChange={(e) => update('summary', e.target.value)} rows={3} className="rounded-md border border-slate-300 px-3 py-2" required minLength={20} maxLength={600} /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">Contenu<textarea value={draft.content} onChange={(e) => update('content', e.target.value)} rows={7} className="rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">URL de l’image<input type="url" value={draft.image_url ?? ''} onChange={(e) => update('image_url', e.target.value)} className="min-h-11 rounded-md border border-slate-300 px-3" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">URL du document joint<input type="url" value={draft.document_url ?? ''} onChange={(e) => update('document_url', e.target.value)} className="min-h-11 rounded-md border border-slate-300 px-3" /></label>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2"><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"><Save className="h-4 w-4" />Enregistrer</button>{editingId && <button type="button" onClick={() => { setDraft(emptyDraft()); setEditingId(null); }} className="min-h-11 rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-700">Annuler</button>}<span aria-live="polite" className="text-sm text-slate-600">{message}</span></div>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-base font-semibold text-slate-900">Contenus enregistrés</h2></div>
        {loading ? <p className="p-5 text-sm text-slate-600" role="status">Chargement…</p> : items.length === 0 ? <p className="p-5 text-sm text-slate-600">Aucune publication enregistrée.</p> : <div className="divide-y divide-slate-200">{items.map((item) => <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{item.category}</span><span className="text-slate-500">{item.status}</span></div><h3 className="mt-2 font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.summary}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(item)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"><Edit3 className="h-4 w-4" />Modifier</button>{item.status !== 'archived' && <button type="button" onClick={() => void archive(item.id)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-300 px-3 text-sm font-semibold text-amber-800"><Archive className="h-4 w-4" />Archiver</button>}</div></article>)}</div>}
      </section>
    </div>
  );
}
