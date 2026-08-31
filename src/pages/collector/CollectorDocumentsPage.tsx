import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { DataTable, Note, PageHeader, type Column } from '@/components/ui/sn';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { normaliserArtisan } from '@/pages/artisan-minier/artisanRow';

interface CollectorDocument {
  id: string;
  artisanName: string;
  type: string;
  name: string;
  url: string | null;
  uploadedAt: string | null;
}

function nameOf(artisan: ArtisanMinier): string {
  return artisan.raison_sociale || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Orpailleur';
}

function safeDocumentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function CollectorDocumentsPage() {
  const { workspace } = useCollectorWorkspace();
  const [documents, setDocuments] = useState<CollectorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true); setError(null);
    try {
      const allowed = new Set(workspace.assignedArtisanIds);
      const artisans = (await artisanMinierService.getAll()).filter((artisan) => allowed.has(artisan.id));
      const rows = await Promise.all(artisans.map(async (row) => ({
        artisan: normaliserArtisan(row),
        documents: await artisanMinierService.getDocuments(row.id) || [],
      })));
      setDocuments(rows.flatMap(({ artisan, documents: items }) => items.map((item) => ({
        id: item.id, artisanName: nameOf(artisan), type: item.type_document || 'document',
        name: item.nom_fichier || 'Document',
        // Le schéma historique conserve généralement un chemin de stockage. Sans
        // RPC de signature, seul un lien absolu déjà délivré peut être ouvert.
        url: safeDocumentUrl(item.chemin_fichier),
        uploadedAt: item.uploaded_at || null,
      }))));
    } catch { setDocuments([]); setError('Les documents autorisés sont momentanément indisponibles.'); }
    finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { void load(); }, [load]);
  const columns: Column<CollectorDocument>[] = [
    { key: 'artisan', header: 'Orpailleur', render: (row) => <strong>{row.artisanName}</strong> },
    { key: 'type', header: 'Type', render: (row) => row.type },
    { key: 'name', header: 'Document', render: (row) => row.name },
    { key: 'date', header: 'Ajouté le', render: (row) => row.uploadedAt ? new Date(row.uploadedAt).toLocaleDateString('fr-FR') : '—' },
    { key: 'open', header: 'Consultation', render: (row) => row.url ? <a className="sn-btn sn-btn--sm" href={row.url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Ouvrir</a> : <span>Indisponible</span> },
  ];
  return <NationalDashboardLayout><main className="sn-page" aria-busy={loading}>
    <PageHeader icon={FileText} title="Documents des orpailleurs assignés" subtitle="Pièces visibles dans votre périmètre RLS." breadcrumb={[{ label: 'Collecteur', to: '/portail-collecteur' }, { label: 'Documents' }]} actions={<button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'sn-spin' : ''} aria-hidden="true" />Actualiser</button>} />
    <div className="mt-4"><Note tone="info" icon={FileText}>Consultation uniquement : aucun téléversement ni suppression n’est exposé sans procédure serveur dédiée.</Note></div>
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}
    <section className="sn-card mt-4"><div className="p-4"><DataTable columns={columns} rows={documents} loading={loading} empty="Aucun document visible pour les orpailleurs assignés." caption="Documents des orpailleurs assignés" /></div></section>
  </main></NationalDashboardLayout>;
}
