import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Beaker, Loader2, PencilLine, Plus } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import './admin.css';

export interface Refinery {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  capacity_grams_per_month: number | null;
  is_active: boolean | null;
  created_at: string;
}

/** Capacité mensuelle en kilogrammes, ou « — » si elle n'est pas déclarée. */
export function formatCapacite(grammes: number | null): string {
  if (!grammes || grammes <= 0) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(grammes / 1000)} kg/mois`;
}

/** Recherche tolérante aux champs non renseignés. */
export function filterRefineries(refineries: Refinery[], recherche: string): Refinery[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) return refineries;
  return refineries.filter((refinery) =>
    [refinery.name, refinery.location, refinery.country, refinery.email, refinery.contact_person]
      .filter(Boolean)
      .some((valeur) => String(valeur).toLowerCase().includes(terme))
  );
}

export function RefineriesPage() {
  const navigate = useNavigate();
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.from('refineries').select('*').order('name');
      if (error) throw error;
      setRefineries(data || []);
    } catch (reason) {
      // Une requête en échec donnait un tableau vide, indiscernable d'un référentiel vide.
      setErreur(errorMessage(reason, 'Impossible de charger le référentiel des raffineries.'));
      setRefineries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => filterRefineries(refineries, recherche), [refineries, recherche]);
  const actives = refineries.filter((refinery) => refinery.is_active).length;
  const capaciteTotale = refineries
    .filter((refinery) => refinery.is_active)
    .reduce((somme, refinery) => somme + Number(refinery.capacity_grams_per_month || 0), 0);

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <PageHeader
          icon={Beaker}
          title="Raffineries partenaires"
          subtitle="Établissements d’affinage habilités à traiter l’or exporté."
          breadcrumb={[{ label: 'Administration' }, { label: 'Raffineries' }]}
          actions={
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/admin/refineries/new')}>
              <Plus aria-hidden="true" /> Ajouter une raffinerie
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          ariaLabel="Référentiel des raffineries"
          items={[
            { label: 'Raffineries enregistrées', value: refineries.length, icon: Beaker, tone: 'blue' },
            { label: 'Actives', value: actives, icon: Beaker, tone: 'green' },
            { label: 'Inactives', value: refineries.length - actives, icon: Beaker, tone: 'red' },
            {
              label: 'Capacité cumulée',
              value: formatCapacite(capaciteTotale),
              hint: 'Établissements actifs uniquement',
              icon: Beaker,
              tone: 'gold',
            },
          ]}
        />

        <section className="sn-card admin-page__filtres" aria-label="Filtres du référentiel">
          <label className="sn-field admin-page__filtre-large">
            <span className="sn-field__label">Rechercher</span>
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Nom, ville, pays, contact…"
            />
          </label>
          <button type="button" className="sn-btn" onClick={() => setRecherche('')} disabled={!recherche}>
            Réinitialiser
          </button>
        </section>

        <Section
          id="raffineries"
          icon={Beaker}
          tone="emerald"
          title={`Raffineries (${visibles.length})`}
          description="Coordonnées et capacité déclarée de chaque établissement."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du référentiel…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucune raffinerie"
              description={
                refineries.length === 0
                  ? 'Le référentiel est vide : ajoutez le premier établissement.'
                  : 'Aucun établissement ne correspond à cette recherche.'
              }
              action={
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/admin/refineries/new')}>
                  Ajouter une raffinerie
                </button>
              }
            />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Raffineries partenaires</caption>
                <thead>
                  <tr>
                    <th scope="col">Établissement</th>
                    <th scope="col">Localisation</th>
                    <th scope="col">Contact</th>
                    <th scope="col" className="is-num">Capacité</th>
                    <th scope="col">État</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((refinery) => (
                    <tr key={refinery.id}>
                      <td>
                        <strong>{refinery.name}</strong>
                      </td>
                      <td>
                        {refinery.location || '—'}
                        {refinery.country && <small>{refinery.country}</small>}
                      </td>
                      <td>
                        <strong>{refinery.contact_person || 'Contact non renseigné'}</strong>
                        <small>{[refinery.email, refinery.phone].filter(Boolean).join(' · ') || '—'}</small>
                      </td>
                      <td className="is-num">{formatCapacite(refinery.capacity_grams_per_month)}</td>
                      <td>
                        <Badge tone={refinery.is_active ? 'success' : 'neutral'}>
                          {refinery.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="admin-page__actions">
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Modifier ${refinery.name}`}
                            onClick={() => navigate(`/admin/refineries/edit/${refinery.id}`)}
                          >
                            <PencilLine aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
