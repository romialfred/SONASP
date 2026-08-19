import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Factory, Loader2, PencilLine, Plus, Settings, Trash2, XCircle } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { UserFriendlyErrorModal } from '@/components/ui/UserFriendlyError';
import { GoldSalesSettingFormPanel } from '@/components/admin/GoldSalesSettingFormPanel';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import {
  deleteGoldSalesSetting,
  getAllGoldSalesSettings,
  getSaleMethods,
  type GoldSalesSettingView,
} from '@/services/goldSalesSettingsService';
import './admin.css';

/** Recherche tolérante aux champs non renseignés. */
export function filterSettings(settings: GoldSalesSettingView[], recherche: string): GoldSalesSettingView[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) return settings;
  return settings.filter((setting) =>
    [setting.mining_company_name, setting.mining_company_abbr, setting.customer_name, setting.contact_person]
      .filter(Boolean)
      .some((valeur) => String(valeur).toLowerCase().includes(terme))
  );
}

export const dateEffet = (valeur?: string | null) => {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
};

export default function GoldSalesSettingsPage() {
  const alerte = useCustomAlert();
  const { open: demanderConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const methodes = getSaleMethods();

  const [settings, setSettings] = useState<GoldSalesSettingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [formOuvert, setFormOuvert] = useState(false);
  const [selection, setSelection] = useState<GoldSalesSettingView | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurModale, setErreurModale] = useState<{ isOpen: boolean; message: string; technicalDetails?: string }>({
    isOpen: false,
    message: '',
  });

  const charger = useCallback(async () => {
    setLoading(true);
    const resultat = await getAllGoldSalesSettings();
    if (resultat.success) {
      setSettings(resultat.data);
    } else {
      const erreur = resultat.error as { message?: string; technicalDetails?: string } | undefined;
      setErreurModale({
        isOpen: true,
        message: erreur?.message || 'Erreur lors du chargement des paramétrages.',
        technicalDetails: erreur?.technicalDetails,
      });
      setSettings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => filterSettings(settings, recherche), [settings, recherche]);
  const actives = settings.filter((setting) => setting.is_active).length;

  const libelleMethode = (methode: string) => methodes.find((item) => item.value === methode)?.label || methode;

  const supprimer = async (setting: GoldSalesSettingView) => {
    // La suppression passait par un `confirm()` natif, hors charte et non traçable.
    const confirme = await demanderConfirmation({
      title: 'Supprimer ce paramétrage ?',
      message: `La règle de vente ${setting.mining_company_name} → ${setting.customer_name} sera définitivement retirée. Les ventes futures ne seront plus encadrées par ce paramétrage.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      severity: 'danger',
    });
    if (!confirme) return;

    setEnCours(setting.id);
    const resultat = await deleteGoldSalesSetting(setting.id);
    setEnCours(null);

    if (resultat.success) {
      alerte.showSuccess('Paramétrage supprimé');
      await charger();
    } else {
      const erreur = resultat.error as { message?: string; technicalDetails?: string } | undefined;
      setErreurModale({
        isOpen: true,
        message: erreur?.message || 'Erreur lors de la suppression.',
        technicalDetails: erreur?.technicalDetails,
      });
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <ConfirmationDialog />

        <PageHeader
          icon={Settings}
          title="Paramétrage des ventes d’or"
          subtitle="Règles de vente applicables à chaque couple mine ↔ client."
          breadcrumb={[{ label: 'Administration' }, { label: 'Paramétrage des ventes' }]}
          actions={
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={() => {
                setSelection(null);
                setFormOuvert(true);
              }}
            >
              <Plus aria-hidden="true" /> Nouveau paramétrage
            </button>
          }
        />

        <StatGrid
          ariaLabel="Portée du paramétrage"
          items={[
            { label: 'Paramétrages définis', value: settings.length, icon: Settings, tone: 'blue' },
            { label: 'Actifs', value: actives, icon: CheckCircle2, tone: 'green' },
            { label: 'Inactifs', value: settings.length - actives, icon: XCircle, tone: 'red' },
            {
              label: 'Mines encadrées',
              value: new Set(settings.map((setting) => setting.mining_company_id)).size,
              icon: Factory,
              tone: 'gold',
            },
          ]}
        />

        <section className="sn-card admin-page__filtres" aria-label="Filtres du paramétrage">
          <label className="sn-field admin-page__filtre-large">
            <span className="sn-field__label">Rechercher</span>
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Mine, client ou contact…"
            />
          </label>
          <button type="button" className="sn-btn" onClick={() => setRecherche('')} disabled={!recherche}>
            Réinitialiser
          </button>
        </section>

        <Section
          id="parametrages"
          icon={Settings}
          tone="emerald"
          title={`Paramétrages (${visibles.length})`}
          description="Plafond de stock, méthode de vente et répartition des frais par couple."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des paramétrages…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucun paramétrage"
              description={
                settings.length === 0
                  ? 'Aucune règle n’encadre encore les ventes par couple mine ↔ client.'
                  : 'Aucun paramétrage ne correspond à cette recherche.'
              }
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => {
                    setSelection(null);
                    setFormOuvert(true);
                  }}
                >
                  Créer un paramétrage
                </button>
              }
            />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Paramétrages des ventes d’or</caption>
                <thead>
                  <tr>
                    <th scope="col">État</th>
                    <th scope="col">Mine</th>
                    <th scope="col">Client</th>
                    <th scope="col" className="is-num">Plafond de stock</th>
                    <th scope="col">Méthode de vente</th>
                    <th scope="col">Frais à la charge du client</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((setting) => {
                    const effet = dateEffet(setting.effective_date);
                    const frais = [
                      setting.refining_fees_paid_by_customer ? 'Raffinage' : null,
                      setting.transport_fees_paid_by_customer ? 'Transport' : null,
                    ].filter(Boolean);
                    return (
                      <tr key={setting.id}>
                        <td>
                          <Badge tone={setting.is_active ? 'success' : 'neutral'}>
                            {setting.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                        <td>
                          <strong>{setting.mining_company_name}</strong>
                          {setting.mining_company_abbr && <small>{setting.mining_company_abbr}</small>}
                        </td>
                        <td>
                          <strong>{setting.customer_name}</strong>
                          {setting.contact_person && <small>{setting.contact_person}</small>}
                        </td>
                        <td className="is-num">
                          <strong>
                            {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(
                              setting.max_stock_percentage
                            )}{' '}
                            %
                          </strong>
                          {effet && <small>Depuis le {effet}</small>}
                        </td>
                        <td>{libelleMethode(setting.sale_method)}</td>
                        <td>{frais.length === 0 ? 'Aucun — à la charge du vendeur' : frais.join(' et ')}</td>
                        <td>
                          <div className="admin-page__actions">
                            <button
                              type="button"
                              className="sn-btn sn-btn--icon"
                              aria-label={`Modifier le paramétrage ${setting.mining_company_name} vers ${setting.customer_name}`}
                              onClick={() => {
                                setSelection(setting);
                                setFormOuvert(true);
                              }}
                            >
                              <PencilLine aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sn-btn sn-btn--icon"
                              aria-label={`Supprimer le paramétrage ${setting.mining_company_name} vers ${setting.customer_name}`}
                              disabled={enCours === setting.id}
                              onClick={() => void supprimer(setting)}
                            >
                              {enCours === setting.id ? (
                                <Loader2 className="sn-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <GoldSalesSettingFormPanel
          setting={selection}
          isOpen={formOuvert}
          onClose={() => {
            setFormOuvert(false);
            setSelection(null);
          }}
          onSuccess={() => {
            alerte.showSuccess(selection ? 'Paramétrage mis à jour' : 'Paramétrage créé');
            void charger();
          }}
          onError={(message: string, technicalDetails?: string) =>
            setErreurModale({ isOpen: true, message, technicalDetails })
          }
        />

        <UserFriendlyErrorModal
          isOpen={erreurModale.isOpen}
          title="Erreur"
          message={erreurModale.message}
          technicalDetails={erreurModale.technicalDetails}
          onClose={() => setErreurModale({ isOpen: false, message: '' })}
          variant="error"
        />
      </div>
    </NationalDashboardLayout>
  );
}
