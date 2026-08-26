import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, PencilLine, Plus, Truck } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import './admin.css';

export type TransportType = 'mine_to_airport' | 'airport_to_refinery' | 'both';

export interface TransportCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_type: TransportType;
  address: string | null;
  contact_person: string | null;
  is_active: boolean | null;
  created_at: string;
}

const TYPES: Record<TransportType, string> = {
  mine_to_airport: 'Mine → aéroport',
  airport_to_refinery: 'Aéroport → raffinerie',
  both: 'Chaîne complète',
};

export const typeTransport = (type?: string | null): string =>
  (type && TYPES[type as TransportType]) || 'Type non défini';

/** Recherche tolérante aux champs non renseignés. */
export function filterCompanies(companies: TransportCompany[], recherche: string): TransportCompany[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) return companies;
  return companies.filter((company) =>
    [company.name, company.email, company.contact_person, company.address]
      .filter(Boolean)
      .some((valeur) => String(valeur).toLowerCase().includes(terme))
  );
}

export function TransportCompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<TransportCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [typeFiltre, setTypeFiltre] = useState<'all' | TransportType>('all');

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.from('transport_companies').select('*').order('name');
      if (error) throw error;
      setCompanies(data || []);
    } catch (reason) {
      // Une requête en échec donnait un tableau vide, indiscernable d'un référentiel vide.
      setErreur(errorMessage(reason, 'Impossible de charger le référentiel des transporteurs.'));
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => {
    const parRecherche = filterCompanies(companies, recherche);
    return typeFiltre === 'all' ? parRecherche : parRecherche.filter((company) => company.company_type === typeFiltre);
  }, [companies, recherche, typeFiltre]);

  const actives = companies.filter((company) => company.is_active).length;

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <PageHeader
          icon={Truck}
          title="Transporteurs agréés"
          subtitle="Sociétés habilitées à convoyer l’or entre les sites, l’aéroport et les raffineries."
          breadcrumb={[{ label: 'Administration' }, { label: 'Transporteurs' }]}
          actions={
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={() => navigate('/admin/transport-companies/new')}
            >
              <Plus aria-hidden="true" /> Ajouter un transporteur
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          ariaLabel="Référentiel des transporteurs"
          items={[
            { label: 'Transporteurs enregistrés', value: companies.length, icon: Truck, tone: 'blue' },
            { label: 'Agréments actifs', value: actives, icon: Truck, tone: 'green' },
            {
              label: 'Chaîne complète',
              value: companies.filter((company) => company.company_type === 'both').length,
              hint: 'Mine jusqu’à la raffinerie',
              icon: Truck,
              tone: 'violet',
            },
            {
              label: 'Segment aéroportuaire',
              value: companies.filter((company) => company.company_type === 'airport_to_refinery').length,
              icon: Truck,
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
              placeholder="Nom, contact, adresse…"
            />
          </label>
          <label className="sn-field">
            <span className="sn-field__label">Segment desservi</span>
            <select value={typeFiltre} onChange={(event) => setTypeFiltre(event.target.value as typeof typeFiltre)}>
              <option value="all">Tous les segments</option>
              {(Object.keys(TYPES) as TransportType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPES[type]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="sn-btn"
            onClick={() => {
              setRecherche('');
              setTypeFiltre('all');
            }}
          >
            Réinitialiser
          </button>
        </section>

        <Section
          id="transporteurs"
          icon={Truck}
          tone="emerald"
          title={`Transporteurs (${visibles.length})`}
          description="Coordonnées et segment de la chaîne desservi par chaque société."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du référentiel…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucun transporteur"
              description={
                companies.length === 0
                  ? 'Le référentiel est vide : ajoutez la première société.'
                  : 'Aucune société ne correspond à ces critères.'
              }
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/admin/transport-companies/new')}
                >
                  Ajouter un transporteur
                </button>
              }
            />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Transporteurs agréés</caption>
                <thead>
                  <tr>
                    <th scope="col">Société</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Segment</th>
                    <th scope="col">Adresse</th>
                    <th scope="col">État</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((company) => (
                    <tr key={company.id}>
                      <td>
                        <strong>{company.name}</strong>
                      </td>
                      <td>
                        <strong>{company.contact_person || 'Contact non renseigné'}</strong>
                        <small>{[company.email, company.phone].filter(Boolean).join(' · ') || '—'}</small>
                      </td>
                      <td>{typeTransport(company.company_type)}</td>
                      <td>{company.address || '—'}</td>
                      <td>
                        <Badge tone={company.is_active ? 'success' : 'neutral'}>
                          {company.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td>
                        <div className="admin-page__actions">
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Modifier ${company.name}`}
                            onClick={() => navigate(`/admin/transport-companies/edit/${company.id}`)}
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
