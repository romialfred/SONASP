import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import {
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  Section,
  StatGrid,
  type Column,
} from "@/components/ui/sn";
import { AffiliationDossier } from "@/components/artisan/AffiliationDossier";
import {
  affiliationCountdown,
  AFFILIATION_STATUS_LABELS,
  type AffiliationCard,
} from "@/lib/affiliationCard";
import { affiliationService } from "@/services/affiliationService";
import { useAuth } from "@/contexts/AuthContext";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import { messageErreurUtilisateur } from "@/lib/presentError";
import type { AdhesionBareme } from "@/types/affiliations";

export default function AffiliationsCartes({
  expirationsOnly = false,
  validationOnly = false,
}: {
  expirationsOnly?: boolean;
  validationOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState<AffiliationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"cartes" | "baremes">("cartes");
  const [artisanId, setArtisanId] = useState("");
  const settings = hasSensitiveCapability(
    user,
    CAPABILITIES.PLATFORM_SETTINGS_MANAGE,
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCards(await affiliationService.list());
      setError("");
    } catch (reason) {
      setError(
        messageErreurUtilisateur(
          reason,
          "Le suivi des affiliations est indisponible.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const current = useMemo(
    () =>
      cards.filter(
        (c) =>
          !cards.some(
            (other) =>
              other.artisan_id === c.artisan_id && other.version > c.version,
          ),
      ),
    [cards],
  );
  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!status || c.statut_effectif === status) &&
          (!expirationsOnly ||
            c.statut_effectif === "expiree" ||
            c.expires_soon) &&
          (!validationOnly || c.statut === "en_cours") &&
          [
            c.numero_affiliation,
            c.holder_name,
            c.snapshot?.nom,
            c.snapshot?.prenoms,
            c.snapshot?.societe,
            c.snapshot?.site_nom,
            c.snapshot?.role,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("fr")
            .includes(search.toLocaleLowerCase("fr")),
      ),
    [cards, search, status, expirationsOnly, validationOnly],
  );
  const columns: Column<AffiliationCard>[] = [
    {
      key: "number",
      header: "Affiliation / version",
      render: (c) => (
        <>
          <strong>{c.numero_affiliation}</strong>
          <div className="affiliation-help">Émission {c.version}</div>
        </>
      ),
    },
    {
      key: "holder",
      header: "Titulaire",
      render: (c) => (
        <>
          <strong>
            {c.snapshot
              ? `${c.snapshot.prenoms} ${c.snapshot.nom}`
              : c.holder_name || "Identité à préparer"}
          </strong>
          {c.snapshot?.societe && (
            <div className="affiliation-help">{c.snapshot.societe}</div>
          )}
          {!c.snapshot && (
            <div className="affiliation-help">Identité à contrôler</div>
          )}
        </>
      ),
    },
    {
      key: "site",
      header: "Site de rattachement",
      render: (c) => c.snapshot?.site_nom || "À vérifier",
    },
    {
      key: "status",
      header: "État de la carte",
      render: (c) => (
        <Badge
          tone={
            c.statut_effectif === "active"
              ? "success"
              : c.statut_effectif === "expiree"
                ? "danger"
                : "neutral"
          }
        >
          {AFFILIATION_STATUS_LABELS[c.statut_effectif]}
        </Badge>
      ),
    },
    {
      key: "expiration",
      header: "Échéance",
      render: (c) => affiliationCountdown(c),
    },
    {
      key: "action",
      header: "Dossier",
      render: (c) => (
        <button className="sn-btn" onClick={() => setArtisanId(c.artisan_id)}>
          Ouvrir
        </button>
      ),
    },
  ];
  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <PageHeader
          icon={CreditCard}
          title={
            expirationsOnly
              ? "Échéances des affiliations"
              : validationOnly
                ? "Validation des cartes"
                : "Affiliations & Cartes"
          }
          subtitle="Émission, droits d’adhésion et validité des cartes Faso SANAMA."
          actions={
            <button
              className="sn-btn"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={16} /> Actualiser
            </button>
          }
        />
        <StatGrid
          ariaLabel="Indicateurs des affiliations"
          items={[
            {
              label: "Affiliations suivies",
              value: String(current.length),
              icon: CreditCard,
              tone: "blue",
            },
            {
              label: "Cartes actives",
              value: String(
                cards.filter((c) => c.statut_effectif === "active").length,
              ),
              icon: BadgeCheck,
              tone: "green",
            },
            {
              label: "Activation en attente",
              value: String(
                cards.filter((c) => c.statut_effectif === "inactive").length,
              ),
              icon: CreditCard,
              tone: "gold",
            },
            {
              label: "Échéances à surveiller",
              value: String(cards.filter((c) => c.expires_soon).length),
              icon: CalendarClock,
              tone: "gold",
            },
          ]}
        />
        {error && (
          <p role="alert" className="affiliation-error">
            {error}
          </p>
        )}
        <div className="affiliation-toolbar" style={{ margin: "18px 0" }}>
          <div role="tablist" aria-label="Gestion des affiliations">
            <button
              role="tab"
              aria-selected={tab === "cartes"}
              className="sn-btn"
              onClick={() => setTab("cartes")}
            >
              Affiliations & Cartes
            </button>
            {settings && (
              <button
                role="tab"
                aria-selected={tab === "baremes"}
                className="sn-btn"
                onClick={() => setTab("baremes")}
              >
                <Settings2 size={15} /> Barèmes
              </button>
            )}
          </div>
          <button
            className="sn-btn"
            onClick={() => navigate("/artisan-minier/liste")}
          >
            Liste des artisans
          </button>
        </div>
        {tab === "baremes" && settings ? (
          <TariffsPanel />
        ) : artisanId ? (
          <Section
            id="dossier-affiliation"
            icon={CreditCard}
            title="Dossier d’affiliation"
          >
            <button
              className="sn-btn"
              onClick={() => setArtisanId("")}
              style={{ marginBottom: 20 }}
            >
              Retour aux affiliations
            </button>
            <AffiliationDossier key={artisanId} artisanId={artisanId} />
          </Section>
        ) : (
          <Section
            id="registre-affiliations"
            icon={CreditCard}
            title="Registre des cartes"
          >
            <div
              className="affiliation-form__pair affiliation-form"
              style={{ marginBottom: 20 }}
            >
              <label>
                Rechercher
                <input
                  type="search"
                  placeholder="Affiliation, titulaire, rôle ou site"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                État
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tous les états</option>
                  {Object.entries(AFFILIATION_STATUS_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {loading ? (
              <p className="sn-empty">Chargement des affiliations…</p>
            ) : cards.length ? (
              <DataTable
                columns={columns}
                rows={filtered}
                caption="Registre des cartes d’affiliation"
                empty="Aucune carte ne correspond à ces filtres."
              />
            ) : (
              <EmptyState
                title="Aucune affiliation disponible"
                description="Les cartes des dossiers enregistrés apparaîtront ici."
              />
            )}
          </Section>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
function TariffsPanel() {
  const [tariffs, setTariffs] = useState<AdhesionBareme[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    affiliationService
      .tariffs()
      .then(setTariffs)
      .catch(() => setError("Les barèmes n’ont pas pu être chargés."));
  }, []);
  return (
    <Section
      id="baremes-adhesion"
      icon={Settings2}
      title="Barèmes des droits d’adhésion"
      description="Chaque échéance conserve le montant et la durée du barème appliqué."
    >
      {error && (
        <p className="affiliation-error" role="alert">
          {error}
        </p>
      )}
      {tariffs.map((t) => (
        <div className="affiliation-receipt" key={t.id}>
          <strong>
            {t.libelle} · {t.role_artisan}
          </strong>
          <span>
            {t.montant} {t.devise} · {t.duree_jours} jours · {t.fuseau}
          </span>
        </div>
      ))}
      <details>
        <summary className="sn-btn">Ajouter un barème</summary>
        <form
          className="affiliation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError("");
            try {
              await affiliationService.configureTariff({
                p_id: key,
                p_libelle: String(data.get("label")),
                p_role: String(data.get("role")),
                p_montant: Number(data.get("amount")),
                p_devise: String(data.get("currency")).toUpperCase(),
                p_duree: Number(data.get("duration")),
                p_fuseau: String(data.get("timezone")),
                p_alerte: Number(data.get("alert")),
              });
              setTariffs(await affiliationService.tariffs());
              setKey(crypto.randomUUID());
              form.reset();
            } catch (reason) {
              setError(messageErreurUtilisateur(reason));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Libellé
            <input
              name="label"
              required
              minLength={3}
              maxLength={120}
              disabled={busy}
            />
          </label>
          <label>
            Rôle concerné
            <select name="role" required disabled={busy}>
              <option value="">Sélectionner</option>
              <option value="exploitant">Exploitant</option>
              <option value="fournisseur">Fournisseur</option>
              <option value="aide_exploitant">Aide exploitant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="collecteur">
                Collecteur (dossiers existants)
              </option>
            </select>
          </label>
          <div className="affiliation-form__pair">
            <label>
              Montant
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                disabled={busy}
              />
            </label>
            <label>
              Devise (code ISO)
              <input
                name="currency"
                placeholder="Ex. XOF"
                pattern="[A-Za-z]{3}"
                required
                maxLength={3}
                disabled={busy}
              />
            </label>
          </div>
          <div className="affiliation-form__pair">
            <label>
              Durée en jours
              <input
                name="duration"
                type="number"
                required
                min={1}
                max={3660}
                disabled={busy}
              />
            </label>
            <label>
              Alerte avant échéance (jours)
              <input
                name="alert"
                type="number"
                required
                min={0}
                max={365}
                disabled={busy}
              />
            </label>
          </div>
          <label>
            Fuseau de validité
            <input
              name="timezone"
              required
              placeholder="Ex. Africa/Ouagadougou"
              disabled={busy}
            />
          </label>
          <p className="affiliation-help">
            Le montant et la durée sont des paramètres métier explicites. La fin
            de période comprend le dernier jour indiqué.
          </p>
          <button className="sn-btn sn-btn--primary" disabled={busy}>
            Enregistrer ce barème
          </button>
        </form>
      </details>
    </Section>
  );
}
