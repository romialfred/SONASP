import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { DataTable, Note, PageHeader, type Column } from '@/components/ui/sn';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { normaliserArtisan } from '@/pages/artisan-minier/artisanRow';
import { createPrivateSignedUrl } from '@/lib/privateStorage';

interface CollectorDocument {
  id: string;
  artisanName: string;
  type: string;
  name: string;
  path: string;
  bucket: string;
  uploadedAt: string | null;
}

function nameOf(artisan: ArtisanMinier): string {
  return artisan.raison_sociale || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Orpailleur';
}

export default function CollectorDocumentsPage() {
  const { workspace } = useCollectorWorkspace();
  const [documents, setDocuments] = useState<CollectorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openDocument = async (row: CollectorDocument) => {
    setOpening(row.id);
    try {
      const url = await createPrivateSignedUrl(row.bucket, row.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { setError('Ce document ne peut pas être ouvert pour le moment. Réessayez.'); }
    finally { setOpening(null); }
  };
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
        path: item.chemin_fichier,
        bucket: item.storage_bucket || 'artisan-documents',
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
    { key: 'open', header: 'Consultation', render: (row) => <button type="button" className="sn-btn sn-btn--sm" disabled={opening !== null} onClick={() => void openDocument(row)}><ExternalLink aria-hidden="true" />{opening === row.id ? 'Ouverture…' : 'Ouvrir'}</button> },
  ];
  return <NationalDashboardLayout><main className="sn-page" aria-busy={loading}>
    <PageHeader icon={FileText} title="Documents des orpailleurs assignés" subtitle="Pièces visibles dans votre périmètre RLS." breadcrumb={[{ label: 'Collecteur', to: '/portail-collecteur' }, { label: 'Documents' }]} actions={<button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'sn-spin' : ''} aria-hidden="true" />Actualiser</button>} />
    <div className="mt-4"><Note tone="info" icon={FileText}>Consultez les pièces des artisans qui vous sont assignés.</Note></div>
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}
    <section className="sn-card mt-4"><div className="p-4"><DataTable columns={columns} rows={documents} loading={loading} empty="Aucun document visible pour les orpailleurs assignés." caption="Documents des orpailleurs assignés" /></div></section>
  </main></NationalDashboardLayout>;
}
