import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, KeyRound, Loader2, Mail, MailCheck, PencilLine,
  Plus, Power, PowerOff, Send, ServerCog, ShieldCheck, Trash2,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  etatVerification,
  MODES_CHIFFREMENT,
  modeChiffrement,
  notificationsService,
  type ConfigurationCourriel,
} from '@/services/notificationsService';
import './admin.css';
import './messagerie.css';

/**
 * Paramètres de messagerie de la plateforme.
 *
 * ══ OÙ VIT LE MOT DE PASSE ══
 *
 * Nulle part dans ce fichier, ni dans aucun autre du dépôt. Il est écrit dans
 * `snp_configuration_courriel`, table dont les droits sont retirés à `anon` et
 * `authenticated` : même avec une session valide et un appel direct à l'API, la
 * colonne n'est pas lisible. Seule la fonction de bord `envoyer-courriel`, qui
 * s'exécute avec la clé de service, peut la lire — par
 * `snp_configuration_courriel_active()`, réservée à ce rôle.
 *
 * Cet écran ne fait donc que poser le secret et dire s'il est posé. Il ne le
 * réaffiche jamais : la seule façon de le changer est de le remplacer.
 *
 * ══ POURQUOI PLUSIEURS JEUX ══
 *
 * Un serveur se remplace un jour, et l'on veut préparer le suivant sans couper
 * le courant. Plusieurs jeux coexistent donc, un seul actif — garanti par un
 * index unique partiel en base, non par une règle d'écran.
 */

/** Le mode et son libellé, pour l'affichage en liste. */
function libelleMode(config: ConfigurationCourriel): string {
  const cle = modeChiffrement(config.port, config.securise);
  return MODES_CHIFFREMENT.find((mode) => mode.cle === cle)?.libelle ?? 'Inconnu';
}

export function MessageriePage() {
  const navigate = useNavigate();
  const [configurations, setConfigurations] = useState<ConfigurationCourriel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [destinataireEssai, setDestinataireEssai] = useState('');
  const [essaiEnCours, setEssaiEnCours] = useState(false);
  const [resultatEssai, setResultatEssai] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setConfigurations(await notificationsService.configurations());
    } catch (raison) {
      // Une lecture en échec rendait une liste vide, indiscernable d'une
      // messagerie non configurée : on nomme la panne.
      setErreur(errorMessage(raison, 'Impossible de lire les paramètres de messagerie.'));
      setConfigurations([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const actif = useMemo(
    () => configurations.find((config) => config.actif) ?? null,
    [configurations],
  );

  /** Toute action d'écriture passe par ici : même traitement d'erreur, même rechargement. */
  const agir = async (uid: string, action: () => Promise<void>, succes: string) => {
    setEnCours(uid);
    setErreur(null);
    setMessage(null);
    try {
      await action();
      setMessage(succes);
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’opération a échoué.'));
    } finally {
      setEnCours(null);
    }
  };

  const supprimer = (config: ConfigurationCourriel) => {
    if (!window.confirm(
      `Retirer le jeu « ${config.libelle} » ? Cette suppression est définitive.`,
    )) return;
    void agir(
      config.uid,
      () => notificationsService.supprimerConfiguration(config.uid),
      `Le jeu « ${config.libelle} » a été retiré.`,
    );
  };

  const eprouver = async () => {
    setEssaiEnCours(true);
    setResultatEssai(null);
    try {
      const reponse = await notificationsService.testerMessagerie(destinataireEssai || undefined);
      setResultatEssai(reponse.envoye
        ? { ok: true, texte: `Message parti vers ${destinataireEssai || 'votre adresse'}.` }
        // Le message du serveur SMTP est rendu tel quel : « authentication
        // failed » se corrige, « échec d'envoi » ne dit rien.
        : { ok: false, texte: reponse.erreur || 'Le serveur a refusé le message.' });
    } catch (raison) {
      setResultatEssai({ ok: false, texte: errorMessage(raison, 'L’essai n’a pas abouti.') });
    } finally {
      setEssaiEnCours(false);
      await charger();
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <PageHeader
          icon={Mail}
          title="Messagerie de la plateforme"
          subtitle="Serveur d’envoi des notifications adressées aux sociétés, aux comptoirs et aux agents."
          breadcrumb={[{ label: 'Administration' }, { label: 'Messagerie' }]}
          actions={
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={() => navigate('/admin/messagerie/nouveau')}
            >
              <Plus aria-hidden="true" /> Ajouter un paramètre SMTP
            </button>
          }
          info={{
            titre: 'Ce que devient le mot de passe',
            contenu: (
              <>
                <p>
                  Il est enregistré dans une table dont la lecture est retirée aux comptes de
                  l’application. Seule la fonction d’envoi, qui s’exécute côté serveur, peut
                  l’atteindre.
                </p>
                <p>
                  Il n’apparaît ni dans le code, ni dans le dépôt, ni dans les pages chargées par
                  le navigateur. Il n’est jamais réaffiché : pour le changer, on le remplace.
                </p>
              </>
            ),
          }}
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && <Note tone="success" icon={CheckCircle2}>{message}</Note>}

        <StatGrid
          ariaLabel="État de la messagerie"
          items={[
            {
              label: 'Jeux enregistrés',
              value: configurations.length,
              icon: ServerCog,
              tone: 'blue',
            },
            {
              label: 'Serveur en service',
              value: actif ? actif.libelle : 'Aucun',
              hint: actif ? `${actif.hote}:${actif.port}` : 'Aucun courriel ne part',
              icon: actif ? Power : PowerOff,
              tone: actif ? 'green' : 'red',
            },
            {
              label: 'Expéditeur affiché',
              value: actif ? actif.expediteur_nom : '—',
              hint: actif?.expediteur_courriel ?? 'Défini par le jeu actif',
              icon: MailCheck,
              tone: 'gold',
            },
            {
              label: 'Dernière vérification',
              value: actif?.derniere_verification
                ? new Date(actif.derniere_verification).toLocaleDateString('fr-FR')
                : '—',
              hint: actif?.derniere_erreur ? 'En échec' : 'Essai réussi',
              icon: ShieldCheck,
              tone: actif?.derniere_erreur ? 'red' : 'green',
            },
          ]}
        />

        {!chargement && configurations.length > 0 && !actif && (
          <Note tone="warning" icon={AlertTriangle}>
            Aucun jeu n’est en service : les notifications restent en file d’attente et aucun
            courriel ne part. Activez un jeu pour rétablir les envois.
          </Note>
        )}

        <Section
          id="jeux"
          icon={ServerCog}
          tone="blue"
          title={`Paramètres enregistrés (${configurations.length})`}
          description="Un seul jeu est en service à la fois. Les autres restent disponibles pour un basculement."
        >
          {chargement ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Lecture des paramètres…
            </div>
          ) : configurations.length === 0 ? (
            <EmptyState
              title="Aucun paramètre SMTP"
              description="Tant qu’aucun serveur n’est renseigné, la plateforme n’adresse aucun courriel : les notifications restent visibles dans l’application seulement."
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/admin/messagerie/nouveau')}
                >
                  <Plus aria-hidden="true" /> Ajouter un paramètre SMTP
                </button>
              }
            />
          ) : (
            <div className="messagerie__liste">
              {configurations.map((config) => {
                const etat = etatVerification(config);
                const occupe = enCours === config.uid;
                return (
                  <article
                    key={config.uid}
                    className={`messagerie__jeu${config.actif ? ' is-actif' : ''}`}
                  >
                    <header>
                      <div className="messagerie__jeu-titre">
                        <h3>{config.libelle}</h3>
                        <Badge tone={config.actif ? 'success' : 'neutral'}>
                          {config.actif ? 'En service' : 'Hors service'}
                        </Badge>
                        {!config.mot_de_passe_defini && (
                          <Badge tone="danger" icon={KeyRound}>Mot de passe manquant</Badge>
                        )}
                      </div>
                      <div className="admin-page__actions">
                        <button
                          type="button"
                          className="sn-btn sn-btn--icon"
                          aria-label={`Modifier ${config.libelle}`}
                          title="Modifier"
                          onClick={() => navigate(`/admin/messagerie/${config.uid}`)}
                        >
                          <PencilLine aria-hidden="true" />
                        </button>
                        {config.actif ? (
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Mettre ${config.libelle} hors service`}
                            title="Mettre hors service"
                            disabled={occupe}
                            onClick={() => void agir(
                              config.uid,
                              () => notificationsService.desactiverConfiguration(config.uid),
                              `« ${config.libelle} » est hors service : plus aucun courriel ne part.`,
                            )}
                          >
                            <PowerOff aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Mettre ${config.libelle} en service`}
                            title={config.mot_de_passe_defini
                              ? 'Mettre en service'
                              : 'Renseignez d’abord le mot de passe'}
                            disabled={occupe || !config.mot_de_passe_defini}
                            onClick={() => void agir(
                              config.uid,
                              () => notificationsService.activerConfiguration(config.uid),
                              `« ${config.libelle} » est en service.`,
                            )}
                          >
                            <Power aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="sn-btn sn-btn--icon"
                          aria-label={`Retirer ${config.libelle}`}
                          title={config.actif
                            ? 'Mettez d’abord ce jeu hors service'
                            : 'Retirer'}
                          disabled={occupe || config.actif}
                          onClick={() => supprimer(config)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </header>

                    <dl className="messagerie__faits">
                      <div>
                        <dt>Serveur</dt>
                        <dd>{config.hote}</dd>
                      </div>
                      <div>
                        <dt>Port</dt>
                        <dd>{config.port}</dd>
                      </div>
                      <div>
                        <dt>Chiffrement</dt>
                        <dd>{libelleMode(config)}</dd>
                      </div>
                      <div>
                        <dt>Identifiant</dt>
                        <dd>{config.identifiant}</dd>
                      </div>
                      <div>
                        <dt>Expéditeur</dt>
                        <dd>{config.expediteur_nom} &lt;{config.expediteur_courriel}&gt;</dd>
                      </div>
                      <div>
                        <dt>Mot de passe</dt>
                        <dd>
                          {config.mot_de_passe_defini ? '•••••••• (enregistré)' : 'Non renseigné'}
                          {config.mot_de_passe_modifie_le && (
                            <small>
                              posé le {new Date(config.mot_de_passe_modifie_le).toLocaleDateString('fr-FR')}
                            </small>
                          )}
                        </dd>
                      </div>
                    </dl>

                    <p className={`messagerie__etat is-${etat.ton}`}>{etat.texte}</p>
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          id="essai"
          icon={Send}
          tone="emerald"
          title="Éprouver le serveur en service"
          description="Un message réel est adressé. Si le serveur refuse, son motif est rendu tel quel."
        >
          {!actif ? (
            <Note tone="warning" icon={AlertTriangle}>
              Aucun jeu n’est en service : il n’y a rien à éprouver.
            </Note>
          ) : (
            <div className="messagerie__essai">
              <label className="sn-field">
                <span className="sn-field__label">Adresse de destination</span>
                <input
                  type="email"
                  value={destinataireEssai}
                  onChange={(evenement) => setDestinataireEssai(evenement.target.value)}
                  placeholder="Laissez vide pour vous l’adresser à vous-même"
                />
              </label>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                disabled={essaiEnCours}
                onClick={() => void eprouver()}
              >
                {essaiEnCours
                  ? <><Loader2 className="sn-spin" aria-hidden="true" /> Envoi…</>
                  : <><Send aria-hidden="true" /> Envoyer un message d’essai</>}
              </button>
            </div>
          )}
          {resultatEssai && (
            <div className="messagerie__resultat">
              <Note
                tone={resultatEssai.ok ? 'success' : 'danger'}
                icon={resultatEssai.ok ? CheckCircle2 : AlertTriangle}
              >
                {resultatEssai.texte}
              </Note>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default MessageriePage;
