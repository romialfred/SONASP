import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AffiliationsCartes from "./AffiliationsCartes";
import type { AffiliationCard } from "@/lib/affiliationCard";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  artisans: vi.fn(),
  tariffs: vi.fn(),
  configureTariff: vi.fn(),
  capabilities: [] as string[],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "reviewer", is_active: true, capabilities: mocks.capabilities },
  }),
}));
vi.mock("@/components/layout/NationalDashboardLayout", () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/services/affiliationService", () => ({
  affiliationService: {
    list: mocks.list,
    tariffs: mocks.tariffs,
    configureTariff: mocks.configureTariff,
  },
}));
vi.mock("@/services/artisanMinierService", () => ({
  artisanMinierService: { getAll: mocks.artisans },
}));
vi.mock("@/components/artisan/AffiliationDossier", () => ({
  AffiliationDossier: ({
    artisanId,
    initialCardId,
    onBack,
    onCardChange,
  }: {
    artisanId: string;
    initialCardId?: string;
    onBack: () => void;
    onCardChange: (id: string) => void;
  }) => (
    <section aria-label="Détail de l’affiliation">
      <p>
        {artisanId} · {initialCardId}
      </p>
      <button onClick={onBack}>Retour au registre</button>
      <button onClick={() => onCardChange("older-card")}>
        Émission précédente
      </button>
    </section>
  ),
}));

function card(values: Partial<AffiliationCard> = {}): AffiliationCard {
  return {
    id: "card-a",
    artisan_id: "artisan-a",
    numero_carte: "BF-A-2026",
    numero_affiliation: "BF-A-2026",
    version: 1,
    template_version: "v1",
    statut: "validee",
    statut_effectif: "active",
    holder_name: "Aminata TEST",
    snapshot: {
      nom: "TEST",
      prenoms: "Aminata",
      societe: null,
      titulaire_id: null,
      role: "exploitant",
      photo_reference: "private/photo",
      site_nom: "Site Alpha",
      commune: "Ouagadougou",
      numero_affiliation: "BF-A-2026",
    },
    validated_at: "2026-09-01",
    activated_at: "2026-09-01",
    valid_from: "2026-09-01",
    valid_until: "2027-08-31",
    jours_restants: 359,
    server_date: "2026-09-06",
    render_status: "ready",
    render_revision: 1,
    recto_path: null,
    verso_path: null,
    pdf_path: null,
    verification_token: "private-reference",
    created_at: "2026-09-01T10:00:00Z",
    replaced_by: null,
    adhesion_status: "paye",
    ...values,
  };
}
const records = [
  card({
    id: "old-a",
    version: 1,
    statut_effectif: "expiree",
    expires_soon: false,
  }),
  card({ id: "card-a", version: 2, expires_soon: true }),
  card({
    id: "card-b",
    artisan_id: "artisan-b",
    numero_affiliation: "BF-B-2026",
    holder_name: "Adama TEST",
    snapshot: null,
    identity_ready: false,
    statut: "en_cours",
    statut_effectif: "non_validee",
    adhesion_status: "non_renseigne",
    valid_until: null,
  }),
  card({
    id: "card-c",
    artisan_id: "artisan-c",
    numero_affiliation: "BF-C-2026",
    holder_name: "Titulaire en attente",
    snapshot: null,
    identity_ready: true,
    statut_effectif: "inactive",
    adhesion_status: "en_attente",
    valid_until: null,
  }),
];
function Location() {
  return (
    <output aria-label="Adresse actuelle">
      {useLocation().pathname}
      {useLocation().search}
    </output>
  );
}
function view(
  entry = "/artisan-minier/cartes/suivi",
  props: Parameters<typeof AffiliationsCartes>[0] = {},
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AffiliationsCartes {...props} />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.capabilities = [
    "artisan.cards.manage",
    "artisan.membership.manage",
    "platform.settings.manage",
  ];
  mocks.list.mockResolvedValue(records);
  mocks.tariffs.mockResolvedValue([]);
  mocks.artisans.mockResolvedValue([
    {
      id: "new-artisan",
      type_personne: "physique",
      type_artisan: "exploitant",
      nom: "TEST",
      prenoms: "Nouveau",
      telephone: "+22670000000",
      actif: true,
    },
    {
      id: "inactive-artisan",
      nom: "Archivé",
      type_personne: "physique",
      type_artisan: "exploitant",
      telephone: "+22670000001",
      actif: false,
    },
  ]);
});

describe("Registre Affiliations & Cartes", () => {
  it("compte une seule émission courante par titulaire et affiche les droits autoritatifs", async () => {
    view();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("Émission 2")).toBeInTheDocument();
    expect(within(table).getByText("Payé")).toBeInTheDocument();
    expect(within(table).getByText("Non renseigné")).toBeInTheDocument();
    expect(
      screen.getByText("Affiliations suivies").parentElement,
    ).toHaveTextContent("3");
    expect(screen.getByText("Cartes actives").parentElement).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByRole("button", { name: /0 carte expirée/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 identité à contrôler/ }),
    ).toBeInTheDocument();
  });
  it("combine recherche, statut et filtres métier puis les réinitialise", async () => {
    view();
    await screen.findByRole("table");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Rechercher une affiliation" }),
      { target: { value: "Aminata" } },
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filtres" }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Rôle du titulaire" }),
      { target: { value: "fournisseur" } },
    );
    expect(
      screen.getByText("Aucun dossier ne correspond à ces filtres."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Réinitialiser les filtres" })[0],
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      4,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Statut de la carte" }),
      { target: { value: "non_validee" } },
    );
    expect(
      within(screen.getByRole("table")).getByText("BF-B-2026"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).queryByText("BF-A-2026"),
    ).not.toBeInTheDocument();
  });
  it("ouvre les tâches et onglets sur leurs vrais dossiers", async () => {
    view();
    await screen.findByRole("table");
    fireEvent.click(
      screen.getByRole("button", { name: /1 identité à contrôler/ }),
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    expect(
      within(screen.getByRole("table")).getByText("BF-B-2026"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activations" }));
    expect(
      within(screen.getByRole("table")).getByText("BF-C-2026"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Expirations" }));
    expect(
      within(screen.getByRole("table")).getByText("BF-A-2026"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).queryByText("BF-C-2026"),
    ).not.toBeInTheDocument();
  });
  it("préserve la validation documentaire distincte de l’activation", async () => {
    view("/artisan-minier/cartes/validation", { validationOnly: true });
    const table = await screen.findByRole("table");
    expect(
      screen.getByRole("heading", { name: "Cartes à valider" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("BF-B-2026")).toBeInTheDocument();
    expect(within(table).queryByText("BF-C-2026")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activations" }));
    expect(
      within(screen.getByRole("table")).getByText("BF-C-2026"),
    ).toBeInTheDocument();
  });
  it("permet de parcourir les onglets au clavier", async () => {
    view();
    await screen.findByRole("table");
    fireEvent.keyDown(
      screen.getByRole("tab", { name: "Registre des cartes" }),
      { key: "End" },
    );
    expect(screen.getByRole("tab", { name: "Expirations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Expirations" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Expirations" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tab", { name: "Activations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("conserve l’alerte d’une carte active pendant le contrôle de sa correction", async () => {
    mocks.list.mockResolvedValue([
      card({ version: 1, expires_soon: true }),
      card({
        id: "correction",
        version: 2,
        statut: "en_cours",
        statut_effectif: "non_validee",
        expires_soon: false,
        valid_until: null,
      }),
    ]);
    view();
    await screen.findByRole("table");
    expect(screen.getByText("Cartes actives").parentElement).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByText("Échéances à surveiller").parentElement,
    ).toHaveTextContent("1");
    expect(screen.getByText("Émission 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Expirations" }));
    expect(screen.getByText("Émission 1")).toBeInTheDocument();
    expect(screen.queryByText("Émission 2")).not.toBeInTheDocument();
  });
  it("ouvre une émission dans une adresse persistante et revient au registre", async () => {
    view();
    await screen.findByRole("table");
    const row = screen
      .getByRole("button", { name: "BF-A-2026" })
      .closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Consulter" }));
    expect(
      screen.getByRole("region", { name: "Détail de l’affiliation" }),
    ).toHaveTextContent("artisan-a · card-a");
    expect(
      screen.queryByRole("heading", { name: "Affiliations & Cartes" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Adresse actuelle")).toHaveTextContent(
      "?artisan=artisan-a&carte=card-a",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Émission précédente" }),
    );
    expect(screen.getByLabelText("Adresse actuelle")).toHaveTextContent(
      "carte=older-card",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retour au registre" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse actuelle")).toHaveTextContent(
      "/artisan-minier/cartes/suivi",
    );
  });
  it("restaure directement un dossier sans charger le registre", () => {
    view("/artisan-minier/cartes/suivi?artisan=artisan-a&carte=card-a");
    expect(
      screen.getByRole("region", { name: "Détail de l’affiliation" }),
    ).toHaveTextContent("artisan-a · card-a");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("sélectionne un titulaire actif pour une nouvelle affiliation sans créer ni générer une carte", async () => {
    view();
    await screen.findByRole("table");
    fireEvent.click(
      screen.getByRole("button", { name: "Nouvelle affiliation" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Nouvelle affiliation" });
    expect(
      await within(dialog).findByRole("button", { name: /Nouveau TEST/ }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Archivé")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/après confirmation du paiement/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Nouveau TEST/ }),
    );
    expect(screen.getByLabelText("Adresse actuelle")).toHaveTextContent(
      "?artisan=new-artisan",
    );
    expect(mocks.artisans).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("conserve la sélection de page pour copier uniquement les références choisies", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    view();
    await screen.findByRole("table");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Sélectionner BF-B-2026" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copier les références" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("BF-B-2026"));
    expect(await screen.findByText("Références copiées.")).toHaveAttribute(
      "role",
      "status",
    );
    fireEvent.click(screen.getByRole("button", { name: "Désélectionner" }));
    expect(
      screen.queryByRole("button", { name: "Copier les références" }),
    ).not.toBeInTheDocument();
  });
  it("ne présente pas de zéros comme données en cas d’échec et permet la reprise", async () => {
    mocks.list.mockRejectedValueOnce(new Error("indisponible"));
    view();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Affiliations suivies").parentElement,
    ).toHaveTextContent("—");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
  it("retient la dernière lecture lorsque l’actualisation échoue", async () => {
    view();
    await screen.findByRole("table");
    mocks.list.mockRejectedValueOnce(new Error("indisponible"));
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Les dernières données chargées restent affichées.",
    );
    expect(
      screen.getByText("Affiliations suivies").parentElement,
    ).toHaveTextContent("3");
  });
  it("masque la création et les barèmes sans habilitation", async () => {
    mocks.capabilities = [];
    view();
    await screen.findByRole("table");
    expect(
      screen.queryByRole("button", { name: "Nouvelle affiliation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Barèmes d’adhésion" }),
    ).not.toBeInTheDocument();
    expect(mocks.tariffs).not.toHaveBeenCalled();
  });
  it("permet la consultation des barèmes sans autoriser leur modification", async () => {
    mocks.capabilities = ["artisan.membership.manage"];
    mocks.tariffs.mockResolvedValue([
      {
        id: "price",
        libelle: "Adhésion annuelle",
        role_artisan: "exploitant",
        montant: 100,
        devise: "XOF",
        duree_jours: 365,
        fuseau: "Africa/Ouagadougou",
      },
    ]);
    view();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("tab", { name: "Barèmes d’adhésion" }));
    expect(await screen.findByText(/Adhésion annuelle/)).toBeInTheDocument();
    expect(screen.queryByText("Ajouter un barème")).not.toBeInTheDocument();
  });
  it("ouvre le barème depuis le lien du dossier de paiement", async () => {
    view("/artisan-minier/cartes/suivi?onglet=baremes");
    await waitFor(() => expect(mocks.tariffs).toHaveBeenCalled());
    expect(
      screen.getByRole("tab", { name: "Barèmes d’adhésion" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
