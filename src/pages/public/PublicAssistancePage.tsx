import { HelpCircle, KeyRound, LifeBuoy, Send } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';
import { SectionHeading } from './PublicComponents';
import { usePublicLocale } from './PublicLocaleContext';
import { sendAssistanceRequest, validateAssistance, type AssistanceErrors, type AssistancePayload } from './publicSupport';

const initialPayload = (): AssistancePayload => ({
  name: '', email: '', company: '', category: '', subject: '', message: '', website: '', startedAt: Date.now(),
});

export default function PublicAssistancePage() {
  const { locale } = usePublicLocale();
  const [payload, setPayload] = useState<AssistancePayload>(initialPayload);
  const [errors, setErrors] = useState<AssistanceErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const isFrench = locale === 'fr';
  const faqs = useMemo(() => [
    { q: isFrench ? 'Comment accéder au Portail Mine ?' : 'How do I access the Mine Portal?', a: isFrench ? 'Utilisez le compte attribué à votre société minière. Si votre compte n’est pas encore activé, rapprochez-vous de votre administrateur habilité.' : 'Use the account assigned to your mining company. If it is not active yet, contact your authorized administrator.' },
    { q: isFrench ? 'Comment récupérer mon mot de passe ?' : 'How do I recover my password?', a: isFrench ? 'La page de connexion donne accès au parcours sécurisé de récupération du mot de passe.' : 'The sign-in page provides access to the secure password recovery flow.' },
    { q: isFrench ? 'Quelles informations joindre à une demande ?' : 'What should I include in a request?', a: isFrench ? 'Précisez votre société, l’opération concernée, la date et le résultat attendu. Ne transmettez jamais votre mot de passe.' : 'Specify your company, the affected operation, the date and the expected outcome. Never share your password.' },
  ], [isFrench]);

  const update = (field: keyof AssistancePayload, value: string) => {
    setPayload((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateAssistance(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`assistance-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      await sendAssistanceRequest(payload);
      setStatus('success');
      setPayload(initialPayload());
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="public-page">
      <PageMetadata title="Assistance | Plateforme SONASP" description="Centre d’aide, récupération d’accès et formulaire sécurisé d’assistance pour les utilisateurs de la plateforme SONASP." openGraph={{ type: 'website', locale: 'fr_BF', siteName: 'SONASP' }} />
      <header className="public-page-hero">
        <div className="public-shell">
          <SectionHeading eyebrow={isFrench ? 'Centre d’aide' : 'Help center'} title={isFrench ? 'Assistance aux utilisateurs de la plateforme' : 'Platform user support'} description={isFrench ? 'Consultez les réponses essentielles ou transmettez une demande structurée à l’équipe d’assistance.' : 'Review essential answers or submit a structured request to the support team.'} as="h1" />
        </div>
      </header>
      <section className="public-section public-assistance-page">
        <div className="public-shell public-assistance-page__grid">
          <div id="faq">
            <h2>{isFrench ? 'Questions fréquentes' : 'Frequently asked questions'}</h2>
            <div className="public-faq-list">
              {faqs.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}
            </div>
            <div className="public-assistance-shortcuts">
              <Link to="/recuperer-acces"><KeyRound aria-hidden="true" /><span>{isFrench ? 'Mot de passe oublié' : 'Forgot password'}</span></Link>
              <a href="#incident"><LifeBuoy aria-hidden="true" /><span>{isFrench ? 'Déclarer un incident' : 'Report an incident'}</span></a>
              <a href="#faq"><HelpCircle aria-hidden="true" /><span>{isFrench ? 'Consulter les guides' : 'View guides'}</span></a>
            </div>
          </div>
          <form id="incident" className="public-assistance-form" onSubmit={submit} noValidate>
            <div><span>{isFrench ? 'Demande d’assistance' : 'Support request'}</span><h2>{isFrench ? 'Décrivez votre besoin' : 'Describe your request'}</h2></div>
            {Object.keys(errors).length > 0 && <div className="public-form-alert" role="alert">{isFrench ? 'Vérifiez les champs signalés.' : 'Please review the highlighted fields.'}</div>}
            <div className="public-form-grid">
              <label>Nom complet<input id="assistance-name" value={payload.name} onChange={(e) => update('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'assistance-name-error' : undefined} autoComplete="name" />{errors.name && <small id="assistance-name-error">{errors.name}</small>}</label>
              <label>Adresse électronique<input id="assistance-email" type="email" value={payload.email} onChange={(e) => update('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'assistance-email-error' : undefined} autoComplete="email" />{errors.email && <small id="assistance-email-error">{errors.email}</small>}</label>
              <label>Société ou institution<input id="assistance-company" value={payload.company} onChange={(e) => update('company', e.target.value)} autoComplete="organization" /></label>
              <label>Type de demande<select id="assistance-category" value={payload.category} onChange={(e) => update('category', e.target.value)} aria-invalid={!!errors.category} aria-describedby={errors.category ? 'assistance-category-error' : undefined}><option value="">Sélectionner</option><option value="access">Accès au compte</option><option value="operation">Opération métier</option><option value="incident">Incident technique</option><option value="document">Document ou publication</option><option value="other">Autre demande</option></select>{errors.category && <small id="assistance-category-error">{errors.category}</small>}</label>
            </div>
            <label>Objet<input id="assistance-subject" value={payload.subject} onChange={(e) => update('subject', e.target.value)} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? 'assistance-subject-error' : undefined} />{errors.subject && <small id="assistance-subject-error">{errors.subject}</small>}</label>
            <label>Message<textarea id="assistance-message" rows={7} value={payload.message} onChange={(e) => update('message', e.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'assistance-message-error' : 'assistance-message-help'} /><span id="assistance-message-help">Ne transmettez aucun mot de passe ni secret d’accès.</span>{errors.message && <small id="assistance-message-error">{errors.message}</small>}</label>
            <label className="public-honeypot" aria-hidden="true">Site web<input id="assistance-website" tabIndex={-1} autoComplete="off" value={payload.website} onChange={(e) => update('website', e.target.value)} /></label>
            <button className="public-button public-button--primary" type="submit" disabled={status === 'sending'}><Send aria-hidden="true" />{status === 'sending' ? 'Envoi…' : 'Envoyer la demande'}</button>
            <div className="public-form-status" aria-live="polite">{status === 'success' && (isFrench ? 'Votre demande a été enregistrée.' : 'Your request has been recorded.')}{status === 'error' && (isFrench ? 'Le service est momentanément indisponible. Réessayez ultérieurement.' : 'The service is temporarily unavailable. Please try again later.')}</div>
          </form>
        </div>
      </section>
    </div>
  );
}
