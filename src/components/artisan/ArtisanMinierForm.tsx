import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Contact,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Plus,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Field, Note } from "@/components/ui/sn";
import { CustomAlert } from "@/components/ui/CustomAlert";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { useAuth } from "@/contexts/AuthContext";
import { canManageMiningRegistry } from "@/lib/miningRegistryAccess";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import { messageErreurUtilisateur } from "@/lib/presentError";
import { secureRandomId } from "@/lib/secureRandom";
import {
  artisanMinierService,
  type ArtisanMinier,
  type TypePersonne,
} from "@/services/artisanMinierService";
import {
  LIBELLES_MOYEN,
  MOYEN_VIDE,
  TYPES_BANCAIRE,
  TYPES_MOBILE,
  appliquerPrincipalUnique,
  artisanMoyenPaiementService,
  validerMoyen,
  type MoyenPaiement,
  type TypeMoyenPaiement,
} from "@/services/artisanMoyenPaiementService";
import type { CarteProfessionnelle } from "@/services/carteProfessionnelleService";
import { artisanalSiteService } from "@/services/artisanalSiteService";
import type { ArtisanalSite } from "@/types/artisanalSite";
import {
  ARTISAN_ROLE_LABELS,
  EMPTY_ARTISAN_FORM,
  artisanErrors,
  completionRate,
  dossierRequirements,
  valuesFromArtisan,
  type ArtisanDossier,
  type ArtisanFormValues,
} from "@/lib/artisanDossier";
import {
  artisanDossierService,
  type ExploitantOption,
} from "@/services/artisanDossierService";
import {
  artisanDocumentService,
  type ArtisanDocument,
  type DocumentOwner,
  type PendingArtisanDocument,
} from "@/services/artisanDocumentService";
import { artisanFullName } from "@/utils/artisanIdentity";
import { ArtisanDossierFields, DossierSection } from "./ArtisanDossierFields";
import { ArtisanDocuments } from "./ArtisanDocuments";
import {
  confirmArtisanLeave,
  useArtisanUnsavedChanges,
} from "@/hooks/useArtisanUnsavedChanges";
import "./artisan-form.css";
export {
  EMPTY_ARTISAN_FORM,
  calculateAge,
  completionRate,
  validateArtisan,
  valuesFromArtisan,
} from "@/lib/artisanDossier";
export type { ArtisanFormValues } from "@/lib/artisanDossier";
export type {
  TypePersonne,
  TypeArtisan,
} from "@/services/artisanMinierService";
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PIECE_MAX_BYTES = 5 * 1024 * 1024;
export interface ArtisanMinierFormProps {
  artisan?: Partial<ArtisanMinier> | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ArtisanMinierForm({
  artisan,
  onCancel,
  onSuccess,
}: ArtisanMinierFormProps) {
  const { user } = useAuth();
  const canManagePaymentMethods = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_PAYMENT_METHODS_MANAGE,
  );
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const [values, setValues] = useState<ArtisanFormValues>(() =>
    valuesFromArtisan(artisan),
  );
  const [moyens, setMoyens] = useState<MoyenPaiement[]>([]);
  const [paymentLoadError, setPaymentLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [edited, setEdited] = useState(false);
  const [savedDocs, setSavedDocs] = useState<ArtisanDocument[]>([]);
  const [pending, setPending] = useState<PendingArtisanDocument[]>([]);
  const [documentError, setDocumentError] = useState("");
  const [sitesDisponibles, setSitesDisponibles] = useState<ArtisanalSite[]>([]);
  const [sitesError, setSitesError] = useState("");
  const [parent, setParent] = useState<ExploitantOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExploitantOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [cartePreview, setCartePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [verifyingMoyenId, setVerifyingMoyenId] = useState<string | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [dirtyMoyenIds, setDirtyMoyenIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmTransition, setConfirmTransition] = useState(false);
  useEffect(() => {
    setConfirmTransition(false);
  }, [values.type_artisan, values.exploitant_id]);
  const savingRef = useRef(false);
  const creationId = useRef(secureRandomId());
  const savedRecord = useRef<Partial<ArtisanDossier> | null>(artisan || null);
  const savedValues = useRef(
    artisan ? JSON.stringify(valuesFromArtisan(artisan)) : "",
  );
  const drafts = useRef<Partial<Record<TypePersonne, ArtisanFormValues>>>({});
  const isEditMode = Boolean(savedRecord.current?.id);
  const company = values.type_personne === "morale";
  const requirements = dossierRequirements(values);
  const errors = artisanErrors(values);
  const missing = requirements.filter((field) => Boolean(errors[field.key]));
  const completion = completionRate(values);
  const transition =
    !!artisan?.id &&
    (artisan.type_artisan !== values.type_artisan ||
      (artisan.exploitant_id || "") !==
        (values.type_artisan === "aide_exploitant"
          ? values.exploitant_id
          : ""));
  const sections = company
    ? [
        ["profil", "Profil de l’artisan"],
        ["societe", "Société"],
        ["responsable", "Responsable"],
        ["localisation", "Rattachement territorial"],
        ["coordonnees", "Coordonnées"],
        ["piece", "Documents de la société"],
        ["moyens-paiement", "Moyens de paiement"],
        ["carte", "Carte professionnelle"],
      ]
    : [
        ["profil", "Profil de l’artisan"],
        ["identite", "Identité"],
        ["localisation", "Rattachement territorial"],
        ["coordonnees", "Coordonnées"],
        ["piece", "Pièce d’identité"],
        ["moyens-paiement", "Moyens de paiement"],
        ["carte", "Photo et carte"],
      ];
  useArtisanUnsavedChanges(edited || pending.some((d) => d.status !== "saved"));
  const focusField = (key: string) => {
    const target =
      document.getElementById(key) || document.getElementById("profil");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
  };
  useEffect(() => {
    let alive = true;
    artisanalSiteService
      .listSites()
      .then((list) => {
        if (alive) setSitesDisponibles(list);
      })
      .catch(() => {
        if (alive)
          setSitesError(
            "Les sites n’ont pas pu être chargés. Le rattachement pourra être complété ultérieurement.",
          );
      });
    if (artisan?.id)
      artisanDocumentService
        .list(artisan.id)
        .then((list) => {
          if (alive) setSavedDocs(list);
        })
        .catch((e) => {
          if (alive) setDocumentError(e.message);
        });
    if (artisan?.exploitant_id)
      artisanDossierService
        .getExploitant(artisan.exploitant_id)
        .then((value) => {
          if (alive) setParent(value);
        })
        .catch((e) => {
          if (alive) setSearchError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [artisan?.id, artisan?.exploitant_id]);
  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError("");
    const timer = setTimeout(() => {
      artisanDossierService
        .searchExploitants(query, savedRecord.current?.id)
        .then((list) => {
          if (alive) setResults(list);
        })
        .catch((e) => {
          if (alive) setSearchError(e.message);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    const photo = [...pending]
      .reverse()
      .find((d) => d.type === "photo" && d.owner === "artisan");
    let url: string | undefined;
    let alive = true;
    if (photo) {
      url = URL.createObjectURL(photo.file);
      setPhotoPreview(url);
    } else if (artisan?.photo_url)
      artisanDocumentService
        .photoUrl(artisan.photo_url)
        .then((value) => {
          if (alive) setPhotoPreview(value);
        })
        .catch(() => {
          if (alive) setPhotoPreview("");
        });
    else setPhotoPreview("");
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pending, artisan?.photo_url]);
  const changeType = (type: TypePersonne) => {
    drafts.current[values.type_personne] = values;
    const restored = drafts.current[type] || {
      ...EMPTY_ARTISAN_FORM,
      responsable: { ...EMPTY_ARTISAN_FORM.responsable },
    };
    setValues({
      ...restored,
      type_personne: type,
      type_artisan: values.type_artisan,
    });
    setSubmitted(false);
    setCartePreview(null);
    setEdited(true);
  };
  const handlePreview = async () => {
    if (!(company ? values.raison_sociale : values.nom)) {
      showError("Renseignez l’identité avant de générer l’aperçu.");
      return;
    }
    setGenerating(true);
    try {
      const { carteProfessionnelleGeneratorService } = await import(
        "@/services/carteProfessionnelleGeneratorService"
      );
      const image =
        await carteProfessionnelleGeneratorService.generatePreviewDataUrl(
          {
            ...values,
            photo_url: company ? null : photoPreview,
            sexe: values.sexe || null,
          } as Partial<ArtisanMinier>,
          {
            numero_carte: artisan?.numero_carte || "SONASP/AM/APERCU",
            date_delivrance: new Date().toISOString().slice(0, 10),
            date_expiration: new Date(Date.now() + 365 * 86400000)
              .toISOString()
              .slice(0, 10),
            statut: "en_cours",
            numero_securite: "0000000000",
            qr_code_data: JSON.stringify({ numero_carte: "APERCU" }),
          } as Partial<CarteProfessionnelle>,
        );
      setCartePreview(image);
    } catch {
      showError("L’aperçu de la carte n’a pas pu être généré.");
    } finally {
      setGenerating(false);
    }
  };

  const ajouterMoyen = () => {
    if (!canManagePaymentMethods) return;
    setMoyens((courants) => {
      const nouveau = {
        ...MOYEN_VIDE(artisan?.id || ""),
        est_principal: courants.length === 0,
      };
      return [...courants, nouveau];
    });
  };

  const modifierMoyen = <C extends keyof MoyenPaiement>(
    index: number,
    champ: C,
    valeur: MoyenPaiement[C],
  ) => {
    if (!canManagePaymentMethods) return;
    const id = moyens[index]?.id;
    if (id) setDirtyMoyenIds((current) => new Set(current).add(id));
    setMoyens((courants) =>
      courants.map((moyen, rang) =>
        rang === index ? { ...moyen, [champ]: valeur } : moyen,
      ),
    );
  };

  const retirerMoyen = (index: number) => {
    if (!canManagePaymentMethods) return;
    setMoyens((courants) => {
      const restants = courants.filter((_, rang) => rang !== index);
      // Retirer le principal laisserait la liste sans defaut.
      return restants.length > 0 &&
        !restants.some((moyen) => moyen.est_principal)
        ? appliquerPrincipalUnique(restants, 0)
        : restants;
    });
  };

  const erreurMoyens = canManagePaymentMethods
    ? moyens.map(validerMoyen).find(Boolean) || null
    : null;

  useEffect(() => {
    if (!artisan?.id) return;
    let monte = true;
    artisanMoyenPaiementService
      .listerParArtisan(artisan.id)
      .then((liste) => monte && setMoyens(liste))
      .catch(() => {
        if (monte) {
          setPaymentLoadError(true);
          showError(
            "Les moyens de paiement n’ont pas pu être chargés. Rechargez la fiche avant de les modifier.",
          );
        }
      });
    return () => {
      monte = false;
    };
  }, [artisan?.id]);

  const handleReviewMoyen = async (moyen: MoyenPaiement, approuve: boolean) => {
    if (!canManagePaymentMethods || !moyen.id || verifyingMoyenId) return;
    if (dirtyMoyenIds.has(moyen.id)) {
      showError(
        "Enregistrez d’abord les modifications avant de vérifier cette coordonnée.",
      );
      return;
    }
    const motif = reviewReasons[moyen.id]?.trim();
    if (!approuve && (!motif || motif.length < 10)) {
      showError("Le rejet exige un motif d’au moins dix caractères.");
      return;
    }

    setVerifyingMoyenId(moyen.id);
    try {
      const reviewed = await artisanMoyenPaiementService.verifier(
        moyen.id,
        approuve,
        approuve ? undefined : motif,
      );
      setMoyens((current) =>
        current.map((item) => (item.id === reviewed.id ? reviewed : item)),
      );
      setReviewReasons((current) => ({ ...current, [moyen.id as string]: "" }));
      showSuccess(
        approuve
          ? "Moyen de paiement vérifié"
          : "Moyen de paiement rejeté et désactivé",
      );
    } catch (reason) {
      showError(messageErreurUtilisateur(reason));
    } finally {
      setVerifyingMoyenId(null);
    }
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (savingRef.current) return;
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      focusField(first);
      return;
    }
    if (paymentLoadError && canManagePaymentMethods) {
      showError(
        "Rechargez les moyens de paiement avant d’enregistrer pour préserver les coordonnées existantes.",
      );
      return;
    }
    if (erreurMoyens) {
      showError(erreurMoyens);
      document.getElementById("moyens-paiement")?.scrollIntoView();
      return;
    }
    if (!isEditMode && !canManageMiningRegistry(user)) {
      showError(
        "La création des artisans est réservée à la DGMG et à l’administrateur.",
      );
      return;
    }
    if (transition && !confirmTransition) {
      showError(
        "Confirmez le changement de rôle ou d’exploitant avant l’enregistrement.",
      );
      return;
    }
    const inactive = pending.filter(
      (doc) =>
        doc.status !== "saved" &&
        (company ? doc.owner === "artisan" : doc.owner !== "artisan"),
    );
    if (
      inactive.length &&
      !window.confirm(
        `${inactive.length} pièce(s) appartiennent au brouillon ${company ? "personne physique" : "personne morale"}. Elles ne seront pas enregistrées avec ce dossier. Continuer ?`,
      )
    )
      return;
    savingRef.current = true;
    setSaving(true);
    try {
      const fingerprint = JSON.stringify(values);
      let record = savedRecord.current;
      if (!record?.id || savedValues.current !== fingerprint) {
        record = await artisanDossierService.save(values, {
          id: record?.id || null,
          creationId: creationId.current,
          expectedUpdatedAt: record?.updated_at || null,
          confirmTransition,
        });
        savedRecord.current = record;
        savedValues.current = fingerprint;
      }
      if (!record?.id)
        throw new Error("L’identifiant du dossier n’a pas été confirmé.");
      const failures: string[] = [];
      if (canManagePaymentMethods) {
        try {
          await artisanMoyenPaiementService.remplacerPourArtisan(
            record.id,
            moyens,
          );
          setDirtyMoyenIds(new Set());
        } catch {
          failures.push("les moyens de paiement");
        }
      }
      const active = pending.filter(
        (d) =>
          (company ? d.owner !== "artisan" : d.owner === "artisan") &&
          d.status !== "saved",
      );
      for (const doc of active) {
        setPending((list) =>
          list.map((d) =>
            d.id === doc.id
              ? { ...d, status: "uploading", error: undefined }
              : d,
          ),
        );
        try {
          const uploaded = await artisanDocumentService.upload(
            record.id,
            doc,
            record.responsable?.id,
          );
          setSavedDocs((list) => [
            uploaded,
            ...list.filter((d) => d.id !== uploaded.id),
          ]);
          if (doc.replacesId) {
            await artisanDocumentService.remove(doc.replacesId);
            setSavedDocs((list) => list.filter((d) => d.id !== doc.replacesId));
          }
          setPending((list) =>
            list.map((d) =>
              d.id === doc.id ? { ...d, status: "saved", error: undefined } : d,
            ),
          );
        } catch {
          failures.push(doc.title);
          setPending((list) =>
            list.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    status: "failed",
                    error:
                      "Le dépôt ou le remplacement n’a pas abouti. Réessayez sans recréer le dossier.",
                  }
                : d,
            ),
          );
        }
      }
      const latest = await artisanMinierService.getById(record.id);
      savedRecord.current = { ...record, updated_at: latest.updated_at };
      if (failures.length) {
        showError(
          "Fiche enregistrée. À reprendre : " +
            failures.join(", ") +
            ". Les pièces réussies sont conservées.",
        );
      } else {
        setEdited(false);
        setPending([]);
        showSuccess(
          isEditMode ? "Fiche artisan mise à jour" : "Artisan enregistré",
        );
        onSuccess();
      }
    } catch (error) {
      showError(messageErreurUtilisateur(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const documentBlock = (owner: DocumentOwner, photo = false) => (
    <ArtisanDocuments
      owner={owner}
      saved={savedDocs}
      pending={pending}
      busy={saving}
      photo={photo}
      onAdd={(docs) => {
        setPending((list) => [...list, ...docs]);
        setEdited(true);
      }}
      onRemovePending={(id) =>
        setPending((list) => list.filter((d) => d.id !== id))
      }
      onRemoveSaved={async (doc) => {
        await artisanDocumentService.remove(doc.id);
        setSavedDocs((list) => list.filter((d) => d.id !== doc.id));
      }}
      onRetry={() => void handleSubmit()}
    />
  );
  const cancel = () => {
    if (
      (!edited && !pending.some((d) => d.status !== "saved")) ||
      confirmArtisanLeave()
    )
      onCancel();
  };
  return (
    <div className="artisan-form artisan-dossier">
      <CustomAlert {...alertState} onClose={closeAlert} />
      <div className="artisan-form__layout">
        <form
          className="artisan-form__main"
          noValidate
          onSubmit={handleSubmit}
          onChange={() => setEdited(true)}
        >
          <fieldset disabled={saving} className="artisan-dossier__fieldset">
            <ArtisanDossierFields
              values={values}
              setValues={(next) => {
                setValues(next);
                setEdited(true);
              }}
              errors={submitted ? errors : {}}
              isEditMode={isEditMode}
              onTypeChange={changeType}
              sites={sitesDisponibles}
              sitesError={sitesError}
              parent={parent}
              query={query}
              setQuery={setQuery}
              results={results}
              searching={searching}
              searchError={searchError}
              onParent={(value) => {
                setParent(value);
                setValues((current) => ({
                  ...current,
                  exploitant_id: value?.id || "",
                }));
                setEdited(true);
              }}
              documents={documentBlock}
            />
            {documentError && (
              <Note tone="danger" icon={AlertCircle}>
                {documentError}
                <button
                  type="button"
                  className="sn-btn"
                  onClick={async () => {
                    try {
                      if (savedRecord.current?.id) {
                        setSavedDocs(
                          await artisanDocumentService.list(
                            savedRecord.current.id,
                          ),
                        );
                        setDocumentError("");
                      }
                    } catch {
                      setDocumentError(
                        "Les documents restent indisponibles. Réessayez.",
                      );
                    }
                  }}
                >
                  Réessayer
                </button>
              </Note>
            )}

            <DossierSection
              number={company ? 7 : 6}
              id="moyens-paiement"
              title="Moyens de paiement"
              description="Coordonnées de règlement de l’artisan."
            >
              {/* Les coordonnées étaient frappées à chaque règlement, sur l'écran de
                paiement : ressaisie du numéro à chaque fois, et aucune garantie que le
                compte crédité appartienne à l'artisan. */}
              {!canManagePaymentMethods && (
                <Note tone="warning" icon={AlertCircle}>
                  Consultation uniquement : vous ne disposez pas de
                  l’habilitation nécessaire pour modifier les moyens de
                  paiement.
                </Note>
              )}

              {moyens.length === 0 ? (
                <Note tone="warning" icon={AlertCircle}>
                  Aucun moyen de paiement enregistré. Sans coordonnée, cet
                  artisan ne pourra pas être réglé : ajoutez-en au moins un.
                </Note>
              ) : (
                <ul className="artisan-form__moyens">
                  {moyens.map((moyen, index) => {
                    const estMobile = TYPES_MOBILE.includes(moyen.type);
                    const estBancaire = TYPES_BANCAIRE.includes(moyen.type);

                    return (
                      <li key={moyen.id || `nouveau-${index}`}>
                        <header>
                          <label className="artisan-form__moyen-principal">
                            <input
                              type="radio"
                              name="moyen-principal"
                              checked={Boolean(moyen.est_principal)}
                              disabled={!canManagePaymentMethods}
                              onChange={() => {
                                if (!canManagePaymentMethods) return;
                                setDirtyMoyenIds((current) => {
                                  const next = new Set(current);
                                  moyens.forEach(
                                    (item) => item.id && next.add(item.id),
                                  );
                                  return next;
                                });
                                setMoyens((courants) =>
                                  appliquerPrincipalUnique(courants, index),
                                );
                              }}
                            />
                            <span>Principal</span>
                          </label>
                          <Badge
                            tone={
                              moyen.verifie_le
                                ? "success"
                                : moyen.actif === false
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {moyen.verifie_le
                              ? "Vérifié"
                              : moyen.actif === false
                                ? "Rejeté / désactivé"
                                : "À vérifier"}
                          </Badge>
                          {canManagePaymentMethods && (
                            <button
                              type="button"
                              aria-label={`Retirer le moyen ${index + 1}`}
                              onClick={() => retirerMoyen(index)}
                            >
                              <X aria-hidden="true" />
                            </button>
                          )}
                        </header>

                        <div className="artisan-form__moyen-champs">
                          <Field label="Type" required>
                            <select
                              value={moyen.type}
                              disabled={!canManagePaymentMethods}
                              onChange={(event) =>
                                modifierMoyen(
                                  index,
                                  "type",
                                  event.target.value as TypeMoyenPaiement,
                                )
                              }
                            >
                              {(
                                Object.keys(
                                  LIBELLES_MOYEN,
                                ) as TypeMoyenPaiement[]
                              ).map((type) => (
                                <option key={type} value={type}>
                                  {LIBELLES_MOYEN[type]}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field
                            label="Titulaire du compte"
                            required
                            hint="Nom porté sur le compte"
                          >
                            <input
                              value={moyen.titulaire}
                              disabled={!canManagePaymentMethods}
                              onChange={(event) =>
                                modifierMoyen(
                                  index,
                                  "titulaire",
                                  event.target.value,
                                )
                              }
                              placeholder="Nom tel qu’enregistré auprès de l’opérateur"
                            />
                          </Field>

                          {estMobile && (
                            <Field label="Numéro de téléphone" required>
                              <input
                                value={moyen.numero_telephone || ""}
                                disabled={!canManagePaymentMethods}
                                onChange={(event) =>
                                  modifierMoyen(
                                    index,
                                    "numero_telephone",
                                    event.target.value,
                                  )
                                }
                                placeholder="+226 __ __ __ __"
                              />
                            </Field>
                          )}

                          {estBancaire && (
                            <>
                              <Field label="Banque" required>
                                <input
                                  value={moyen.banque || ""}
                                  disabled={!canManagePaymentMethods}
                                  onChange={(event) =>
                                    modifierMoyen(
                                      index,
                                      "banque",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Établissement teneur du compte"
                                />
                              </Field>
                              <Field label="Numéro de compte" required>
                                <input
                                  value={moyen.numero_compte || ""}
                                  disabled={!canManagePaymentMethods}
                                  onChange={(event) =>
                                    modifierMoyen(
                                      index,
                                      "numero_compte",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="RIB ou IBAN"
                                />
                              </Field>
                              <Field
                                label="Code SWIFT"
                                hint="Pour un virement international"
                              >
                                <input
                                  value={moyen.code_swift || ""}
                                  disabled={!canManagePaymentMethods}
                                  onChange={(event) =>
                                    modifierMoyen(
                                      index,
                                      "code_swift",
                                      event.target.value,
                                    )
                                  }
                                />
                              </Field>
                            </>
                          )}
                        </div>

                        {canManagePaymentMethods &&
                          moyen.id &&
                          moyen.actif !== false &&
                          !moyen.verifie_le && (
                            <div className="artisan-form__moyen-review">
                              <label htmlFor={`review-reason-${moyen.id}`}>
                                Motif de rejet
                              </label>
                              <input
                                id={`review-reason-${moyen.id}`}
                                value={reviewReasons[moyen.id] || ""}
                                onChange={(event) =>
                                  setReviewReasons((current) => ({
                                    ...current,
                                    [moyen.id as string]: event.target.value,
                                  }))
                                }
                                placeholder="Au moins 10 caractères pour un rejet"
                                disabled={verifyingMoyenId === moyen.id}
                              />
                              <button
                                type="button"
                                className="sn-btn sn-btn--primary sn-btn--sm"
                                disabled={
                                  verifyingMoyenId !== null ||
                                  dirtyMoyenIds.has(moyen.id)
                                }
                                onClick={() =>
                                  void handleReviewMoyen(moyen, true)
                                }
                              >
                                {verifyingMoyenId === moyen.id && (
                                  <Loader2
                                    className="sn-spin"
                                    aria-hidden="true"
                                  />
                                )}
                                Vérifier
                              </button>
                              <button
                                type="button"
                                className="sn-btn sn-btn--sm"
                                disabled={
                                  verifyingMoyenId !== null ||
                                  dirtyMoyenIds.has(moyen.id) ||
                                  (reviewReasons[moyen.id]?.trim().length ||
                                    0) < 10
                                }
                                onClick={() =>
                                  void handleReviewMoyen(moyen, false)
                                }
                              >
                                Rejeter
                              </button>
                            </div>
                          )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {canManagePaymentMethods && (
                <button
                  type="button"
                  className="sn-btn artisan-form__ajout-moyen"
                  onClick={ajouterMoyen}
                >
                  <Plus aria-hidden="true" /> Ajouter un moyen de paiement
                </button>
              )}

              {erreurMoyens && (
                <Note tone="danger" icon={AlertCircle}>
                  {erreurMoyens}
                </Note>
              )}
            </DossierSection>

            <DossierSection
              id="carte"
              number={company ? 8 : 7}
              title={
                company
                  ? "Carte professionnelle"
                  : "Photo et carte professionnelle"
              }
              description={
                company
                  ? "Aperçu du titre au nom de la société."
                  : "Photo d’identité et aperçu de la carte."
              }
            >
              <div className="artisan-form__carte">
                {!company && documentBlock("artisan", true)}
                <div className="artisan-form__apercu">
                  <button
                    type="button"
                    className="sn-btn"
                    onClick={handlePreview}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="sn-spin" /> : <Eye />}{" "}
                    Générer l’aperçu
                  </button>
                  {cartePreview ? (
                    <img
                      src={cartePreview}
                      alt="Aperçu de la carte professionnelle"
                    />
                  ) : (
                    <div className="artisan-form__apercu-vide">
                      <CreditCard />
                      <span>L’aperçu apparaîtra ici</span>
                    </div>
                  )}
                  <small>L’aperçu ne vaut pas délivrance de la carte.</small>
                </div>
              </div>
            </DossierSection>
            {transition && (
              <div className="artisan-dossier__transition">
                <p>
                  Le rôle ou l’exploitant de rattachement va changer. Les
                  productions, paiements et opérations historiques conservent
                  leurs références.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmTransition}
                    onChange={(e) => setConfirmTransition(e.target.checked)}
                  />{" "}
                  Confirmer ce changement de rattachement ou de rôle
                </label>
              </div>
            )}
          </fieldset>
          <div className="sn-form-actions">
            <span className="artisan-form__hint">* Champs obligatoires</span>
            <button
              type="button"
              className="sn-btn"
              onClick={cancel}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="sn-btn sn-btn--primary"
              disabled={saving}
            >
              {saving ? <Loader2 className="sn-spin" /> : <Save />}
              {saving
                ? "Enregistrement…"
                : isEditMode
                  ? "Mettre à jour la fiche"
                  : "Enregistrer l’artisan"}
            </button>
          </div>
        </form>
        <aside className="artisan-form__aside" aria-label="Suivi de la saisie">
          <section className="sn-card artisan-dossier__completion">
            <h2>
              <FileText /> Complétion du formulaire
            </h2>
            <div
              className="artisan-dossier__ring"
              role="progressbar"
              aria-label="Complétude de la fiche"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" />
                <circle
                  className="is-value"
                  cx="60"
                  cy="60"
                  r="50"
                  pathLength="100"
                  strokeDasharray={String(completion) + " 100"}
                />
              </svg>
              <div>
                <strong>{completion} %</strong>
                <span>complété</span>
              </div>
            </div>
            <p>
              <strong>
                {requirements.length - missing.length} champs requis sur{" "}
                {requirements.length}
              </strong>
              <small>
                {missing.length
                  ? missing.length + " champs à compléter"
                  : "Dossier prêt à enregistrer"}
              </small>
            </p>
            {missing.length > 0 && (
              <div className="artisan-dossier__missing">
                <h3>À renseigner</h3>
                <ul>
                  {missing.slice(0, 3).map((field) => (
                    <li key={field.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(true);
                          focusField(field.key);
                        }}
                      >
                        {field.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="artisan-dossier__link"
                  onClick={() => {
                    setSubmitted(true);
                    focusField(missing[0].key);
                  }}
                >
                  Voir les {missing.length} champs manquants →
                </button>
              </div>
            )}
          </section>
          <nav
            className="sn-card artisan-dossier__toc"
            aria-label="Sommaire du dossier"
          >
            <h2>
              <FileText /> Sommaire du dossier
            </h2>
            <ol>
              {sections.map(([id, label], index) => (
                <li key={id}>
                  <a
                    href={"#" + id}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <section className="sn-card artisan-form__resume">
            <h2>
              <Contact /> Fiche en cours
            </h2>
            {!company && photoPreview ? (
              <img
                className="artisan-form__photo"
                src={photoPreview}
                alt="Photo de l’artisan"
              />
            ) : (
              <div className="artisan-form__photo is-vide">
                <UserRound />
              </div>
            )}
            <p className="artisan-form__resume-nom">
              {(company
                ? values.raison_sociale
                : [values.nom, values.prenoms].filter(Boolean).join(" ")) ||
                "Nouvel artisan"}
            </p>
            <dl>
              <div>
                <dt>Qualité</dt>
                <dd>{company ? "Personne morale" : "Personne physique"}</dd>
              </div>
              <div>
                <dt>Rôle</dt>
                <dd>{ARTISAN_ROLE_LABELS[values.type_artisan]}</dd>
              </div>
              {company && (
                <div>
                  <dt>Responsable</dt>
                  <dd>
                    {[values.responsable.nom, values.responsable.prenoms]
                      .filter(Boolean)
                      .join(" ") || "À renseigner"}
                  </dd>
                </div>
              )}
              {values.type_artisan === "aide_exploitant" && (
                <div>
                  <dt>Exploitant</dt>
                  <dd>{parent ? artisanFullName(parent) : "À renseigner"}</dd>
                </div>
              )}
              <div>
                <dt>Site</dt>
                <dd>
                  {values.type_artisan === "aide_exploitant"
                    ? parent?.site_name || "À renseigner par l’exploitant"
                    : sitesDisponibles.find(
                        (s) => s.id === values.artisanal_site_id,
                      )?.name || "Non rattaché"}
                </dd>
              </div>
            </dl>
          </section>
          <p className="artisan-dossier__hint">
            <AlertCircle /> Les pièces seront envoyées à l’enregistrement. Les
            pièces déposées avec succès sont conservées en cas de reprise.
          </p>
        </aside>
      </div>
    </div>
  );
}
