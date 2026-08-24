import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Contact, Loader2, MapPin, Route, Save, Truck } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { ChoiceCards, EmptyState, Field, Note, PageHeader, Section, Segmented } from '@/components/ui/sn';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { useAlert } from '@/hooks/useAlert';
import type { TransportType } from './TransportCompaniesPage';
import './admin.css';

export interface TransportFormValues {
  name: string;
  email: string;
  phone: string;
  company_type: TransportType;
  address: string;
  contact_person: string;
  is_active: boolean;
}

export const EMPTY_TRANSPORT_FORM: TransportFormValues = {
  name: '',
  email: '',
  phone: '',
  company_type: 'both',
  address: '',
  contact_person: '',
  is_active: true,
};

const SEGMENTS: Array<{ value: TransportType; label: string; description: string; icon: typeof Truck }> = [
  { value: 'mine_to_airport', label: 'Mine → aéroport', description: 'Convoyage du site vers l’aéroport', icon: Truck },
  { value: 'airport_to_refinery', label: 'Aéroport → raffinerie', description: 'Acheminement international', icon: Route },
  { value: 'both', label: 'Chaîne complète', description: 'Du site jusqu’à la raffinerie', icon: MapPin },
];

/** Première obligation non satisfaite, ou `null` si la fiche est enregistrable. */
export function validateTransport(values: TransportFormValues): string | null {
  if (!values.name.trim()) return 'La raison sociale est obligatoire.';
  if (!values.contact_person.trim()) return 'Le contact référent est obligatoire.';
  if (!values.email.trim()) return 'L’adresse e-mail est obligatoire.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'L’adresse e-mail est invalide.';
  if (!values.phone.trim()) return 'Le numéro de téléphone est obligatoire.';
  if (!values.company_type) return 'Sélectionnez le segment desservi.';
  return null;
}

export function buildTransportPayload(values: TransportFormValues) {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    company_type: values.company_type,
    address: values.address.trim() || null,
    contact_person: values.contact_person.trim(),
    is_active: values.is_active,
  };
}

export function TransportCompanyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const alerte = useAlert();
  const isEditMode = Boolean(id);

  const [values, setValues] = useState<TransportFormValues>(EMPTY_TRANSPORT_FORM);
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
      const { data, error } = await supabase.from('transport_companies').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) {
        setIntrouvable(true);
        return;
      }
      setValues({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        company_type: (data.company_type as TransportType) || 'both',
        address: data.address || '',
        contact_person: data.contact_person || '',
        is_active: data.is_active !== false,
      });
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger ce transporteur.'));
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

  const setValue = <K extends keyof TransportFormValues>(clef: K, valeur: TransportFormValues[K]) =>
    setValues((current) => ({ ...current, [clef]: valeur }));

  const validationError = validateTransport(values);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // garde-fou contre la double soumission

    const message = validateTransport(values);
    if (message) {
      setErreur(message);
      return;
    }

    setSaving(true);
    setErreur(null);
    try {
      const payload = buildTransportPayload(values);
      if (isEditMode && id) {
        const { error } = await supabase.from('transport_companies').update(payload).eq('id', id);
        if (error) throw error;
        alerte.success('Transporteur mis à jour');
      } else {
        const { error } = await supabase.from('transport_companies').insert([payload]);
        if (error) throw error;
        alerte.success('Transporteur enregistré');
      }
      redirection.current = setTimeout(() => navigate('/admin/transport-companies'), 1200);
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
            icon={Truck}
            title="Transporteur introuvable"
            subtitle="Cette fiche a été supprimée ou la référence est erronée."
            breadcrumb={[
              { label: 'Administration' },
              { label: 'Transporteurs', to: '/admin/transport-companies' },
            ]}
          />
          <EmptyState
            title="Aucune fiche à modifier"
            action={
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/admin/transport-companies')}
              >
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
          icon={Truck}
          title={isEditMode ? 'Modifier le transporteur' : 'Nouveau transporteur'}
          subtitle="Société habilitée à convoyer l’or sur la chaîne d’exportation."
          breadcrumb={[
            { label: 'Administration' },
            { label: 'Transporteurs', to: '/admin/transport-companies' },
            { label: isEditMode ? 'Modification' : 'Nouvelle fiche' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate('/admin/transport-companies')}>
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
            id="societe"
            icon={Truck}
            tone="emerald"
            title="Société"
            description="Raison sociale et état de l’agrément."
          >
            <div className="admin-form__row is-deux">
              <Field label="Raison sociale" required htmlFor="raison-sociale">
                <input
                  id="raison-sociale"
                  value={values.name}
                  onChange={(event) => setValue('name', event.target.value)}
                />
              </Field>
              <div className="sn-field">
                <span className="sn-field__label">État de l’agrément</span>
                <Segmented
                  name="etat-transporteur"
                  value={values.is_active ? 'actif' : 'inactif'}
                  options={[
                    { value: 'actif', label: 'Actif' },
                    { value: 'inactif', label: 'Inactif' },
                  ]}
                  onChange={(etat) => setValue('is_active', etat === 'actif')}
                  ariaLabel="État de l’agrément"
                />
              </div>
            </div>
          </Section>

          <Section
            id="segment"
            icon={Route}
            tone="blue"
            title="Segment desservi"
            description="Portion de la chaîne logistique couverte par l’agrément."
          >
            <ChoiceCards
              name="segment-transport"
              value={values.company_type}
              options={SEGMENTS}
              onChange={(segment) => setValue('company_type', segment)}
              legend="Segment couvert"
            />
          </Section>

          <Section
            id="contact-section"
            icon={Contact}
            tone="violet"
            title="Contact et adresse"
            description="Interlocuteur opérationnel et siège de la société."
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
                  placeholder="contact@exemple.bf"
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

            <Field label="Adresse du siège" wide htmlFor="adresse">
              <input
                id="adresse"
                value={values.address}
                onChange={(event) => setValue('address', event.target.value)}
                placeholder="Quartier, ville…"
              />
            </Field>
          </Section>

          <div className="sn-form-actions">
            {validationError && <span className="admin-form__hint">{validationError}</span>}
            <button
              type="button"
              className="sn-btn"
              onClick={() => navigate('/admin/transport-companies')}
              disabled={saving}
            >
              Annuler
            </button>
            <button type="submit" className="sn-btn sn-btn--primary" disabled={saving || Boolean(validationError)}>
              {saving ? (
                <>
                  <Loader2 className="sn-spin" aria-hidden="true" /> Enregistrement…
                </>
              ) : (
                <>
                  <Save aria-hidden="true" /> {isEditMode ? 'Mettre à jour' : 'Enregistrer le transporteur'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </NationalDashboardLayout>
  );
}
