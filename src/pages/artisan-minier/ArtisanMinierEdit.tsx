import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, UserRound } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, PageHeader } from '@/components/ui/sn';
import { ArtisanMinierForm } from '@/components/artisan/ArtisanMinierForm';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { normaliserArtisan } from './artisanRow';
import { artisanFullName } from '@/utils/artisanIdentity';

export default function ArtisanMinierEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { alertState, showError, closeAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = id ? await artisanMinierService.getById(id) : null;
        if (!active) return;
        setArtisan(data ? normaliserArtisan(data) : null);
        if (!data) showError('Impossible de charger la fiche de cet artisan');
      } catch (reason) {
        if (!active) return;
        showError(reason instanceof Error ? reason.message : 'Impossible de charger la fiche de cet artisan');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const retour = id ? `/artisan-minier/${id}` : '/artisan-minier/liste';

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <div className="sn-note" style={{ justifyContent: 'center' }}>
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la fiche…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!artisan) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <CustomAlert {...alertState} onClose={closeAlert} />
          <PageHeader
            icon={UserRound}
            title="Artisan introuvable"
            subtitle="Cette fiche a été supprimée ou la référence est erronée."
            breadcrumb={[{ label: 'Artisans miniers', to: '/artisan-minier' }, { label: 'Fiche' }]}
          />
          <EmptyState
            title="Aucune fiche à modifier"
            description="Revenez à la liste pour retrouver l’artisan concerné."
            action={
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/artisan-minier/liste')}
              >
                <ArrowLeft aria-hidden="true" /> Retour à la liste
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={UserRound}
          title="Modifier la fiche artisan"
          subtitle={`${artisanFullName(artisan)}${artisan.numero_carte ? ` · ${artisan.numero_carte}` : ''}`}
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: artisanFullName(artisan), to: retour },
            { label: 'Modification' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate(retour)}>
              <ArrowLeft aria-hidden="true" /> Retour au dossier
            </button>
          }
        />

        <ArtisanMinierForm
          artisan={artisan}
          onCancel={() => navigate(retour)}
          onSuccess={() => navigate(retour)}
        />
      </div>
    </NationalDashboardLayout>
  );
}
