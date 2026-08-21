import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail,
  Save, Server, ShieldCheck, UserCircle2,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { errorMessage } from '@/lib/errorMessage';
import {
  MODES_CHIFFREMENT,
  modeChiffrement,
  notificationsService,
  type ConfigurationCourriel,
  type ModeChiffrement,
} from '@/services/notificationsService';
import '@/pages/artisanal-sites/artisanal-site-form.css';
import './messagerie.css';

/**
 * Saisie d'un jeu de paramètres SMTP.
 *
 * ══ CE QUE CET ÉCRAN NE FAIT PAS ══
 *
 * Il ne relit jamais le mot de passe. La fonction de lecture ne le rend pas, et
 * ce n'est pas une précaution d'affichage : la colonne est illisible depuis un
 * compte d'application. Le champ reste donc vide à la modification, et un champ
 * vide vaut « ne change rien ».
 *
 * Il n'écrit rien dans un fichier, ni dans une variable d'environnement du
 * paquet du navigateur. Le secret part directement vers la base par un appel
 * chiffré, et n'existe côté navigateur que le temps de la soumission.
 */

const CHAMPS_VIDES = {
  libelle: '',
  hote: '',
  identifiant: '',
  expediteurCourriel: '',
  expediteurNom: 'Administration SONASP',
  motDePasse: '',
};

export function MessagerieForm() {
  const navigate = useNavigate();
  const { uid } = useParams<{ uid: string }>();
  const modification = Boolean(uid);

  const [champs, setChamps] = useState({ ...CHAMPS_VIDES });
  const [mode, setMode] = useState<ModeChiffrement>('ssl');
  const [port, setPort] = useState(465);
  const [activer, setActiver] = useState(false);
  const [existant, setExistant] = useState<ConfigurationCourriel | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [chargement, setChargement] = useState(modification);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!uid) return;
    setChargement(true);
    try {
      const liste = await notificationsService.configurations();
      const trouve = liste.find((config) => config.uid === uid) ?? null;
      if (!trouve) {
        setErreur('Ce jeu de paramètres n’existe plus.');
        return;
      }
      setExistant(trouve);
      setChamps({
        libelle: trouve.libelle,
        hote: trouve.hote,
        identifiant: trouve.identifiant,
        expediteurCourriel: trouve.expediteur_courriel,
        expediteurNom: trouve.expediteur_nom,
        motDePasse: '',
      });
      setPort(trouve.port);
      setMode(modeChiffrement(trouve.port, trouve.securise));
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de lire ce jeu de paramètres.'));
    } finally {
      setChargement(false);
    }
  }, [uid]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modeChoisi = useMemo(
    () => MODES_CHIFFREMENT.find((entree) => entree.cle === mode) ?? MODES_CHIFFREMENT[0],
    [mode],
  );

  /** Le port suit le mode tant que l'utilisateur ne l'a pas écarté lui-même. */
  const changerMode = (cle: ModeChiffrement) => {
    const suivant = MODES_CHIFFREMENT.find((entree) => entree.cle === cle);
    if (!suivant) return;
    const portCourantEstUnDefaut = MODES_CHIFFREMENT.some((entree) => entree.port === port);
    setMode(cle);
    if (portCourantEstUnDefaut) setPort(suivant.port);
  };

  const poser = (cle: keyof typeof CHAMPS_VIDES) => (valeur: string) =>
    setChamps((etat) => ({ ...etat, [cle]: valeur }));

  const manques = useMemo(() => {
    const liste: string[] = [];
    if (champs.libelle.trim().length < 2) liste.push('un nom qui distingue ce jeu des autres');
    if (!champs.hote.trim()) liste.push('l’adresse du serveur');
    if (!champs.identifiant.trim()) liste.push('l’identifiant de connexion');
    if (!champs.expediteurCourriel.includes('@')) liste.push('une adresse d’expédition valide');
    if (!champs.expediteurNom.trim()) liste.push('le nom affiché de l’expéditeur');
    // À la création le secret est exigé : un jeu sans mot de passe ne peut pas
    // être mis en service, et l'annoncer après coup serait tardif.
    if (!modification && !champs.motDePasse) liste.push('le mot de passe du compte');
    if (!Number.isFinite(port) || port < 1 || port > 65535) liste.push('un port valide');
    return liste;
  }, [champs, modification, port]);

  const enregistrer = async () => {
    if (manques.length > 0) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const saisie = {
        libelle: champs.libelle.trim(),
        hote: champs.hote.trim(),
        port,
        securise: modeChoisi.securise,
        identifiant: champs.identifiant.trim(),
        expediteurCourriel: champs.expediteurCourriel.trim(),
        expediteurNom: champs.expediteurNom.trim(),
        motDePasse: champs.motDePasse || undefined,
      };
      if (uid) {
        await notificationsService.modifierConfiguration(uid, saisie);
      } else {
        await notificationsService.creerConfiguration({ ...saisie, activer });
      }
      navigate('/admin/messagerie');
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’enregistrement a échoué.'));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page site-form">
        <div className="site-form__intro">
          <span className="site-form__intro-icon"><Mail aria-hidden="true" /></span>
          <div>
            <h2>{modification ? 'Modifier un paramètre SMTP' : 'Ajouter un paramètre SMTP'}</h2>
            <p className="site-form__subtitle">
              Serveur d’envoi employé par la plateforme pour adresser ses notifications.
            </p>
          </div>
          <button type="button" className="sn-btn" onClick={() => navigate('/admin/messagerie')}>
            <ArrowLeft aria-hidden="true" /> Retour
          </button>
        </div>

        {erreur && (
          <p className="site-form__error" role="alert">
            <AlertTriangle aria-hidden="true" /> {erreur}
          </p>
        )}

        {chargement ? (
          <div className="site-form__loading">
            <Loader2 aria-hidden="true" /> Lecture du jeu de paramètres…
          </div>
        ) : (
          <div className="site-form__layout">
            <div className="site-form__main">
              <section className="site-form__section">
                <header className="site-form__section-head is-blue">
                  <span className="site-form__section-icon"><Server aria-hidden="true" /></span>
                  <div>
                    <h3>Serveur d’envoi</h3>
                    <p>Coordonnées du serveur sortant fourni par l’hébergeur de la messagerie.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="libelle">
                        Nom de ce jeu <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="libelle"
                        value={champs.libelle}
                        onChange={(evenement) => poser('libelle')(evenement.target.value)}
                        placeholder="Serveur principal"
                      />
                      <small>
                        Sert à distinguer plusieurs serveurs dans la liste. N’apparaît dans aucun
                        courriel.
                      </small>
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="hote">
                        Adresse du serveur <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="hote"
                        value={champs.hote}
                        onChange={(evenement) => poser('hote')(evenement.target.value)}
                        placeholder="mail.exemple.bf"
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="port">
                        Port <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="port"
                        type="number"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(evenement) => setPort(Number(evenement.target.value))}
                      />
                      <small>Renseigné automatiquement selon le chiffrement, modifiable.</small>
                    </div>

                    <div className="site-form__field is-wide">
                      <span className="site-form__label">Chiffrement de la liaison</span>
                      <div className="messagerie__modes">
                        {MODES_CHIFFREMENT.map((entree) => (
                          <label
                            key={entree.cle}
                            className={`messagerie__mode${mode === entree.cle ? ' is-checked' : ''}`}
                          >
                            <input
                              type="radio"
                              name="chiffrement"
                              value={entree.cle}
                              checked={mode === entree.cle}
                              onChange={() => changerMode(entree.cle)}
                            />
                            <span>
                              <strong>{entree.libelle}</strong>
                              <em>Port d’usage {entree.port}</em>
                              <small>{entree.aide}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="site-form__section">
                <header className="site-form__section-head is-amber">
                  <span className="site-form__section-icon"><Lock aria-hidden="true" /></span>
                  <div>
                    <h3>Compte de connexion</h3>
                    <p>Identifiants du compte que le serveur autorise à envoyer.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="identifiant">
                        Identifiant <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="identifiant"
                        value={champs.identifiant}
                        onChange={(evenement) => poser('identifiant')(evenement.target.value)}
                        placeholder="no-reply@exemple.bf"
                        autoComplete="off"
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="motdepasse">
                        Mot de passe {!modification && <i aria-hidden="true">*</i>}
                      </label>
                      <span className="messagerie__secret">
                        <input
                          id="motdepasse"
                          type={secretVisible ? 'text' : 'password'}
                          value={champs.motDePasse}
                          onChange={(evenement) => poser('motDePasse')(evenement.target.value)}
                          placeholder={modification ? '(inchangé)' : '••••••••'}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setSecretVisible((etat) => !etat)}
                          aria-label={secretVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {secretVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                      </span>
                      <small>
                        {modification
                          ? 'Le mot de passe est conservé de façon sécurisée et n’est jamais réaffiché. Laissez le champ vide pour conserver celui en place.'
                          : 'Il est enregistré hors de portée de l’application et n’apparaîtra plus jamais à l’écran.'}
                      </small>
                      {modification && existant?.mot_de_passe_modifie_le && (
                        <small>
                          Dernière modification le{' '}
                          {new Date(existant.mot_de_passe_modifie_le).toLocaleString('fr-FR')}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><UserCircle2 aria-hidden="true" /></span>
                  <div>
                    <h3>Expéditeur affiché</h3>
                    <p>Ce que le destinataire voit dans sa boîte de réception.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="expediteurNom">
                        Nom de l’expéditeur <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="expediteurNom"
                        value={champs.expediteurNom}
                        onChange={(evenement) => poser('expediteurNom')(evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="expediteurCourriel">
                        Adresse d’expédition <i aria-hidden="true">*</i>
                      </label>
                      <input
                        id="expediteurCourriel"
                        type="email"
                        value={champs.expediteurCourriel}
                        onChange={(evenement) => poser('expediteurCourriel')(evenement.target.value)}
                        placeholder="no-reply@exemple.bf"
                      />
                      <small>
                        Beaucoup de serveurs refusent une adresse d’expédition différente de
                        l’identifiant de connexion.
                      </small>
                    </div>

                    <div className="site-form__field is-wide">
                      <span className="site-form__label">Aperçu</span>
                      <div className="messagerie__apercu">
                        <span>De</span>
                        <strong>
                          {champs.expediteurNom || 'Administration SONASP'}
                          {' '}&lt;{champs.expediteurCourriel || 'adresse non renseignée'}&gt;
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="site-form__actions">
                <button type="button" onClick={() => navigate('/admin/messagerie')}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={enregistrement || manques.length > 0}
                  onClick={() => void enregistrer()}
                >
                  {enregistrement
                    ? <><Loader2 className="sn-spin" aria-hidden="true" /> Enregistrement…</>
                    : <><Save aria-hidden="true" /> {modification ? 'Enregistrer les modifications' : 'Enregistrer le paramètre'}</>}
                </button>
              </div>
            </div>

            <aside className="site-form__aside">
              <article className="site-form__card">
                <header>
                  <span className="site-form__card-icon is-emerald"><ShieldCheck aria-hidden="true" /></span>
                  <div>
                    <h3>Où va le mot de passe</h3>
                    <p>Ce qu’il advient du secret que vous saisissez.</p>
                  </div>
                </header>
                <div className="messagerie__aide">
                  <p>
                    Il est écrit dans une table dont la lecture est retirée aux comptes de
                    l’application. Aucun appel depuis le navigateur ne peut l’obtenir, même avec
                    une session d’administrateur.
                  </p>
                  <p>
                    Seule la fonction d’envoi, exécutée côté serveur avec la clé de service, le
                    lit au moment d’ouvrir la connexion.
                  </p>
                  <p>
                    Il ne figure ni dans le code, ni dans le dépôt, ni dans aucun fichier de
                    configuration.
                  </p>
                </div>
              </article>

              {!modification && (
                <article className="site-form__card">
                  <header>
                    <span className="site-form__card-icon is-blue"><KeyRound aria-hidden="true" /></span>
                    <div>
                      <h3>Mise en service</h3>
                      <p>Un seul jeu sert à la fois.</p>
                    </div>
                  </header>
                  <div className="messagerie__aide">
                    <label className="messagerie__bascule">
                      <input
                        type="checkbox"
                        checked={activer}
                        onChange={(evenement) => setActiver(evenement.target.checked)}
                      />
                      <span>Mettre ce jeu en service dès l’enregistrement</span>
                    </label>
                    <p>
                      Le jeu qui sert aujourd’hui sera mis hors service dans le même mouvement :
                      il n’y a jamais deux serveurs actifs.
                    </p>
                  </div>
                </article>
              )}

              {manques.length > 0 && (
                <article className="site-form__card">
                  <header>
                    <span className="site-form__card-icon is-blue"><AlertTriangle aria-hidden="true" /></span>
                    <div>
                      <h3>Reste à renseigner</h3>
                      <p>L’enregistrement attend ces éléments.</p>
                    </div>
                  </header>
                  <ul className="messagerie__manques">
                    {manques.map((manque) => <li key={manque}>{manque}</li>)}
                  </ul>
                </article>
              )}
            </aside>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default MessagerieForm;
