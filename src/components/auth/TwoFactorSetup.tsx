import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { errorMessage } from '@/lib/errorMessage';
import {
  EMETTEUR_TOTP,
  mfaService,
  secretLisible,
  type Enrolement,
} from '@/services/mfaService';
import './two-factor-setup.css';

/**
 * Activation du second facteur.
 *
 * ══ CE QUI A CHANGÉ, ET POURQUOI ══
 *
 * La version précédente composait le secret avec `Math.random()`, l'envoyait à
 * `api.qrserver.com` pour fabriquer l'image, l'enregistrait en clair dans la
 * base — et ne vérifiait jamais le code saisi : six chiffres quelconques
 * activaient la protection.
 *
 * Ici, le secret est produit et détenu par GoTrue, qui le chiffre au repos. Le
 * QR code vient de lui, pas d'un tiers. Le code saisi est réellement vérifié :
 * en cas de succès la session est élevée à `aal2`, et c'est cette élévation —
 * vérifiable en base — qui vaut preuve d'enrôlement.
 */

interface Props {
  onComplete: () => void;
  onCancel?: () => void;
  /** Vrai quand l'enrôlement est imposé : l'abandon n'est alors pas proposé. */
  obligatoire?: boolean;
}

export function TwoFactorSetup({ onComplete, onCancel, obligatoire = false }: Props) {
  const [enrolement, setEnrolement] = useState<Enrolement | null>(null);
  const [code, setCode] = useState('');
  const [chargement, setChargement] = useState(true);
  const [verification, setVerification] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [secretCopie, setSecretCopie] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  const preparer = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setEnrolement(await mfaService.commencerEnrolement());
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’activation n’a pas pu être préparée.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void preparer();
  }, [preparer]);

  const valider = async () => {
    if (!enrolement) return;
    const saisi = code.replace(/\s/g, '');
    if (saisi.length !== 6) {
      setErreur('Le code compte six chiffres.');
      return;
    }

    setVerification(true);
    setErreur(null);
    try {
      await mfaService.verifierCode(enrolement.facteurId, saisi);
      // La base recontrôle : facteur réellement vérifié, et session élevée.
      await mfaService.confirmerEnrolement();
      onComplete();
    } catch (raison) {
      setErreur(errorMessage(raison, 'Le code n’a pas pu être vérifié.'));
      setCode('');
    } finally {
      setVerification(false);
    }
  };

  const copierSecret = async () => {
    if (!enrolement) return;
    try {
      await navigator.clipboard.writeText(enrolement.secret);
      setSecretCopie(true);
      setTimeout(() => setSecretCopie(false), 2000);
    } catch {
      setErreur('La copie a échoué. Recopiez la clé à la main.');
    }
  };

  return (
    <section className="mfa-setup" aria-label="Activation du second facteur">
      <header className="mfa-setup__tete">
        <span className="mfa-setup__icone"><ShieldCheck aria-hidden="true" /></span>
        <div>
          <h2>Activer le second facteur</h2>
          <p>Scannez le QR code puis saisissez le code à 6 chiffres.</p>
        </div>
      </header>

      {erreur && (
        <p className="mfa-setup__erreur" role="alert">
          <AlertTriangle aria-hidden="true" /> {erreur}
        </p>
      )}

      {chargement ? (
        <p className="mfa-setup__chargement">
          <Loader2 className="sn-spin" aria-hidden="true" /> Préparation…
        </p>
      ) : !enrolement ? (
        <div className="mfa-setup__gestes">
          <button type="button" className="sn-btn" onClick={() => void preparer()}>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <ol className="mfa-setup__etapes">
            <li>
              <h3><Smartphone aria-hidden="true" /> Ouvrez votre application</h3>
              <p>
                Ajoutez un compte dans Microsoft ou Google Authenticator
                (« {EMETTEUR_TOTP} »).
              </p>
            </li>

            <li>
              <h3>Scannez le QR code</h3>
              <div className="mfa-setup__qr">
                <img src={enrolement.qrCode} alt="QR code d’enrôlement" width={156} height={156} />
              </div>
              <button
                type="button" className="mfa-setup__lien"
                onClick={() => setSecretVisible((visible) => !visible)}
              >
                {secretVisible
                  ? 'Masquer la clé'
                  : 'Saisie manuelle'}
              </button>
              {secretVisible && (
                <div className="mfa-setup__secret">
                  <code>{secretLisible(enrolement.secret)}</code>
                  <button type="button" onClick={() => void copierSecret()} aria-label="Copier la clé">
                    {secretCopie ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  </button>
                </div>
              )}
            </li>

            <li>
              <h3>Saisissez le code à 6 chiffres</h3>
              <input
                className="mfa-setup__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(evenement) => setCode(evenement.target.value.replace(/[^\d\s]/g, ''))}
                onKeyDown={(evenement) => {
                  if (evenement.key === 'Enter') void valider();
                }}
                placeholder="000000"
                aria-label="Code à six chiffres"
                disabled={verification}
              />
              <p className="mfa-setup__aide">
                Code refusé ? Attendez le suivant puis réessayez.
              </p>
            </li>
          </ol>

          <div className="mfa-setup__gestes">
            {!obligatoire && onCancel && (
              <button type="button" className="sn-btn" onClick={onCancel} disabled={verification}>
                Plus tard
              </button>
            )}
            <button
              type="button" className="sn-btn sn-btn--primary"
              onClick={() => void valider()}
              disabled={verification || code.replace(/\s/g, '').length !== 6}
            >
              {verification
                ? <><Loader2 className="sn-spin" aria-hidden="true" /> Vérification…</>
                : 'Activer'}
            </button>
          </div>

          <p className="mfa-setup__note">
            Appareil perdu ? Un administrateur pourra réinitialiser votre second facteur.
          </p>
        </>
      )}
    </section>
  );
}

export default TwoFactorSetup;
