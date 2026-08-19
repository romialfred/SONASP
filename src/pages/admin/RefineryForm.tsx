import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Beaker, Contact, Gauge, Loader2, MapPin, Save } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Field, Note, PageHeader, Section, Segmented } from '@/components/ui/sn';
import { COUNTRIES } from '@/constants/countries';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { useAlert } from '@/hooks/useAlert';
import './admin.css';

export interface RefineryFormValues {
  name: string;
  location: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string;
  capacity_grams_per_month: string;
  is_active: boolean;
}

export const EMPTY_REFINERY_FORM: RefineryFormValues = {
  name: '',
  location: '',
  country: 'Burkina Faso',
  email: '',
  phone: '',
  contact_person: '',
  capacity_grams_per_month: '',
  is_active: true,
};

/** Première obligation non satisfaite, ou `null` si la fiche est enregistrable. */
export function validateRefinery(values: RefineryFormValues): string | null {
  if (!values.name.trim()) return 'Le nom de l’établissement est obligatoire.';
  if (!values.country) return 'Le pays d’implantation est obligatoire.';
  if (!values.location.trim()) return 'La ville d’implantation est obligatoire.';
  if (!values.contact_person.trim()) return 'Le contact référent est obligatoire.';
  if (!values.email.trim()) return 'L’adresse e-mail est obligatoire.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'L’adresse e-mail est invalide.';
  if (!values.phone.trim()) return 'Le numéro de téléphone est obligatoire.';
  if (values.capacity_grams_per_month) {
    const capacite = Number(values.capacity_grams_per_month);
    if (!Number.isFinite(capacite) || capacite < 0) return 'La capacité mensuelle doit être un nombre positif.';
  }
  return null;
}

export function buildRefineryPayload(values: RefineryFormValues) {
  return {
    name: values.name.trim(),
    location: values.location.trim(),
    country: values.country,
    email: values.email.trim(),
    phone: values.phone.trim(),
    contact_person: values.contact_person.trim(),
    capacity_grams_per_month: values.capacity_grams_per_month ? Number(values.capacity_grams_per_month) : null,
    is_active: values.is_active,
  };
}

export function RefineryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const alerte = useAlert();
  const isEditMode = Boolean(id);

  const [values, setValues] = useState<RefineryFormValues>(EMPTY_REFINERY_FORM);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const redirection = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErreur(null);
    try {
      // `single()` levait une exception sur une référence inconnue et laissait un
      // formulaire vide mais enregistrable, visant une ligne inexistante.
      const { data, error } = await supabase.from('refineries').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) {
        setIntrouvable(true);
        return;
      }
      setValues({
        name: data.name || '',
        location: data.location || '',
        country: data.country || '',
        email: data.email || '',
        phone: data.phone || '',
        contact_person: data.contact_person || '',
        capacity_grams_per_month: data.capacity_grams_per_month?.toString() || '',
        is_active: data.is_active !== false,
      });
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger cette raffinerie.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(
    () => () => {
      if (redirection.current) clearTimeout(redirection.current);
    },
    []
  );

  const setValue = <K extends keyof RefineryFormValues>(clef: K, valeur: RefineryFormValues[K]) =>
    setValues((current) => ({ ...current, [clef]: valeur }));

  const validationError = validateRefinery(values);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // garde-fou contre la double soumission

    const message = validateRefinery(values);
    if (message) {
      setErreur(message);
      return;
    }

    setSaving(true);
    setErreur(null);
    try {
      const payload = buildRefineryPayload(values);
      if (isEditMode && id) {
        const { error } = await supabase.from('refineries').update(payload).eq('id', id);
        if (error) throw error;
        alerte.success('Raffinerie mise à jour');
      } else {
        const { error } = await supabase.from('refineries').insert([payload]);
        if (error) throw error;
        alerte.success('Raffinerie enregistrée');
      }
      redirection.current = setTimeout(() => navigate('/admin/refineries'), 1200);
    } catch (reason) {
      const message = errorMessage(reason, 'Enregistrement impossible.');
      setErreur(message);
      alerte.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <div className="admin-page__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la fiche…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (introuvable) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <PageHeader
            icon={Beaker}
            title="Raffinerie introuvable"
            subtitle="Cette fiche a été supprimée ou la référence est erronée."
            breadcrumb={[{ label: 'Administration' }, { label: 'Raffineries', to: '/admin/refineries' }]}
          />
          <EmptyState
            title="Aucune fiche à modifier"
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/admin/refineries')}>
                <ArrowLeft aria-hidden="true" /> Retour au référentiel
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <PageHeader
          icon={Beaker}
          title={isEditMode ? 'Modifier la raffinerie' : 'Nouvelle raffinerie'}
          subtitle="Établissement d’affinage habilité à traiter l’or exporté."
          breadcrumb={[
            { label: 'Administration' },
            { label: 'Raffineries', to: '/admin/refineries' },
            { label: isEditMode ? 'Modification' : 'Nouvelle fiche' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate('/admin/refineries')}>
              <ArrowLeft aria-hidden="true" /> Retour au référentiel
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <form className="admin-form" onSubmit={handleSubmit} noValidate>
          <Section
            id="identite"
            icon={Beaker}
            tone="emerald"
            title="Établissement"
            description="Dénomination et état de l’agrément."
          >
            <div className="admin-form__row is-deux">
              <Field label="Nom de l’établissement" required htmlFor="nom">
                <input id="nom" value={values.name} onChange={(event) => setValue('name', event.target.value)} />
              </Field>
              <div className="sn-field">
                <span className="sn-field__label">État de l’agrément</span>
                <Segmented
                  name="etat-raffinerie"
                  value={values.is_active ? 'actif' : 'inactif'}
                  options={[
                    { value: 'actif', label: 'Active' },
                    { value: 'inactif', label: 'Inactive' },
                  ]}
                  onChange={(etat) => setValue('is_active', etat === 'actif')}
                  ariaLabel="État de l’agrément"
                />
              </div>
            </div>
          </Section>

          <Section
            id="implantation"
            icon={MapPin}
            tone="blue"
            title="Implantation"
            description="Localisation de l’usine d’affinage."
          >
            <div className="admin-form__row is-deux">
              <Field label="Pays" required htmlFor="pays">
                <select id="pays" value={values.country} onChange={(event) => setValue('country', event.target.value)}>
                  <option value="">Sélectionner un pays</option>
                  {COUNTRIES.map((pays) => (
                    <option key={pays} value={pays}>
                      {pays}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ville" required htmlFor="ville">
                <input
                  id="ville"
                  value={values.location}
                  onChange={(event) => setValue('location', event.target.value)}
                  placeholder="Ville d’implantation"
                />
              </Field>
            </div>
          </Section>

          <Section
            id="contact"
            icon={Contact}
            tone="violet"
            title="Contact référent"
            description="Interlocuteur désigné pour le suivi des lots."
          >
            <div className="admin-form__row is-trois">
              <Field label="Nom du contact" required htmlFor="contact">
                <input
                  id="contact"
                  value={values.contact_person}
                  onChange={(event) => setValue('contact_person', event.target.value)}
                />
              </Field>
              <Field label="Adresse e-mail" required htmlFor="email">
                <input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(event) => setValue('email', event.target.value)}
                  placeholder="contact@exemple.com"
                />
              </Field>
              <Field label="Téléphone" required htmlFor="telephone">
                <input
                  id="telephone"
                  value={values.phone}
                  onChange={(event) => setValue('phone', event.target.value)}
                  placeholder="+226 …"
                />
              </Field>
            </div>
          </Section>

          <Section
            id="capacite"
            icon={Gauge}
            tone="amber"
            title="Capacité de traitement"
            description="Volume mensuel que l’établissement peut affiner."
          >
            <div className="admin-form__row is-un">
              <Field
                label="Capacité mensuelle (grammes)"
                htmlFor="capacite"
                hint={
                  values.capacity_grams_per_month && Number(values.capacity_grams_per_month) > 0
                    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(values.capacity_grams_per_month) / 1000)} kg par mois`
                    : 'Laisser vide si la capacité n’est pas déclarée'
                }
              >
                <input
                  id="capacite"
                  type="number"
                  min="0"
                  step="1000"
                  value={values.capacity_grams_per_month}
                  onChange={(event) => setValue('capacity_grams_per_month', event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <div className="sn-form-actions">
            {validationError && <span className="admin-form__hint">{validationError}</span>}
            <button type="button" className="sn-btn" onClick={() => navigate('/admin/refineries')} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="sn-btn sn-btn--primary" disabled={saving || Boolean(validationError)}>
              {saving ? (
                <>
                  <Loader2 className="sn-spin" aria-hidden="true" /> Enregistrement…
                </>
              ) : (
                <>
                  <Save aria-hidden="true" /> {isEditMode ? 'Mettre à jour' : 'Enregistrer la raffinerie'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </NationalDashboardLayout>
  );
}
