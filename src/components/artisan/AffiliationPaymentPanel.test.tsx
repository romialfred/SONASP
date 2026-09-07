import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliationPaymentPanel } from "./AffiliationPaymentPanel";
import type { AffiliationCard } from "@/lib/affiliationCard";
import type {
  AdhesionBareme,
  AdhesionDroit,
  AdhesionEncaissement,
} from "@/types/affiliations";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  establish: vi.fn(),
  upload: vi.fn(),
  record: vi.fn(),
  signedProof: vi.fn(),
  review: vi.fn(),
  cancelDues: vi.fn(),
  confirm: vi.fn(),
  run: vi.fn(),
  errors: [] as unknown[],
}));
vi.mock("@/services/affiliationService", () => ({
  affiliationService: {
    prepare: mocks.prepare,
    establishDues: mocks.establish,
    uploadPaymentProof: mocks.upload,
    recordReceipt: mocks.record,
    signedPaymentProof: mocks.signedProof,
    reviewReceipt: mocks.review,
    cancelDues: mocks.cancelDues,
  },
}));
const card = {
  id: "card-a",
  artisan_id: "artisan-a",
  server_date: "2026-09-06",
  artisan_role: "exploitant",
  snapshot: { role: "exploitant" },
} as AffiliationCard;
const tariff: AdhesionBareme = {
  id: "tariff-a",
  libelle: "Adhésion exploitant",
  role_artisan: "exploitant",
  montant: 10000,
  devise: "XOF",
  duree_jours: 365,
  fuseau: "Africa/Ouagadougou",
  alerte_jours: 30,
  actif: true,
  created_at: "2026-09-01",
  created_by: "manager",
};
const dues: AdhesionDroit = {
  id: "dues-a",
  carte_id: "card-a",
  artisan_id: "artisan-a",
  bareme_id: "tariff-a",
  montant: 10000,
  devise: "XOF",
  duree_jours: 365,
  fuseau: "Africa/Ouagadougou",
  alerte_jours: 30,
  debut: "2026-01-01",
  fin: "2026-12-31",
  statut: "ouvert",
  created_by: "manager",
  created_at: "2026-09-01",
};
function receipt(
  values: Partial<AdhesionEncaissement> = {},
): AdhesionEncaissement {
  return {
    id: "receipt-a",
    droit_id: "dues-a",
    montant: 10000,
    reference: "TEST-RECU-2026",
    mode: "cash",
    date_paiement: "2026-09-05",
    annee_adhesion: 2026,
    lieu_paiement: "Caisse Ouagadougou",
    preuve_path: "dues-a/receipt-a/proof.pdf",
    statut: "en_attente",
    created_by: "cashier",
    created_at: "2026-09-05T08:00:00Z",
    confirmed_by: null,
    confirmed_at: null,
    revised_by: null,
    revised_at: null,
    motif: null,
    ...values,
  };
}
type Props = Parameters<typeof AffiliationPaymentPanel>[0];
function panel(props: Partial<Props> = {}) {
  return (
    <MemoryRouter>
      <AffiliationPaymentPanel
        card={card}
        dues={dues}
        receipts={[]}
        tariffs={[tariff]}
        manage
        confirm
        userId="reviewer"
        busy={false}
        run={mocks.run}
        onConfirm={mocks.confirm}
        {...props}
      />
    </MemoryRouter>
  );
}
function view(props: Partial<Props> = {}) {
  return render(panel(props));
}
function openPayment() {
  fireEvent.click(
    screen.getByRole("button", { name: "Enregistrer un paiement" }),
  );
  return screen.getByRole("form", {
    name: "Enregistrer les droits d’affiliation",
  });
}
function fillPayment(
  form: HTMLElement,
  file = new File(["%PDF-1.4 TEST"], "preuve.pdf", { type: "application/pdf" }),
) {
  fireEvent.change(within(form).getByLabelText("Date de paiement"), {
    target: { value: "2026-09-05" },
  });
  fireEvent.change(within(form).getByLabelText("Lieu de paiement"), {
    target: { value: "Caisse Ouagadougou" },
  });
  fireEvent.change(within(form).getByLabelText("Référence du reçu"), {
    target: { value: "TEST-RECU-2026" },
  });
  fireEvent.change(within(form).getByLabelText("Mode de paiement"), {
    target: { value: "virement_bancaire" },
  });
  fireEvent.change(within(form).getByLabelText(/Preuve de paiement/), {
    target: { files: [file] },
  });
  return file;
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  mocks.errors = [];
  mocks.run.mockImplementation(async (action: () => Promise<unknown>) => {
    try {
      await action();
      return true;
    } catch (error) {
      mocks.errors.push(error);
      return false;
    }
  });
  mocks.upload.mockResolvedValue({ path: "dues-a/receipt-a/proof.pdf" });
  mocks.signedProof.mockResolvedValue("https://private.example.test/proof");
  mocks.establish.mockResolvedValue(dues);
  mocks.prepare.mockResolvedValue({});
  mocks.record.mockResolvedValue(receipt());
  mocks.review.mockResolvedValue(receipt());
});

describe("Configuration et paiement des droits d’affiliation", () => {
  it("configure l’année, le barème du titulaire et la période inclusive sans générer de carte", async () => {
    view({
      dues: null,
      tariffs: [
        tariff,
        {
          ...tariff,
          id: "other",
          role_artisan: "collecteur",
          libelle: "Collecteur",
        },
      ],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Configurer les droits" }),
    );
    expect(screen.getByLabelText("Année d’affiliation")).toHaveValue(2026);
    expect(
      screen.getByRole("combobox", { name: "Barème d’adhésion" }),
    ).toHaveValue("tariff-a");
    expect(
      screen.queryByRole("option", { name: /Collecteur/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Année d’affiliation"), {
      target: { value: "2027" },
    });
    expect(screen.getByLabelText("Début de validité")).toHaveValue(
      "2027-01-01",
    );
    expect(screen.getByLabelText("Fin de validité incluse")).toHaveValue(
      "2027-12-31",
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Enregistrer la période" })
        .closest("form")!,
    );
    await waitFor(() => expect(mocks.establish).toHaveBeenCalledTimes(1));
    expect(mocks.establish).toHaveBeenCalledWith({
      p_id: expect.any(String),
      p_carte: "card-a",
      p_bareme: "tariff-a",
      p_debut: "2027-01-01",
      p_fin: "2027-12-31",
    });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("respecte la durée du barème lors d’un début personnalisé et d’une année bissextile", () => {
    view({ dues: null, tariffs: [{ ...tariff, duree_jours: 366 }] });
    fireEvent.click(
      screen.getByRole("button", { name: "Configurer les droits" }),
    );
    fireEvent.change(screen.getByLabelText("Début de validité"), {
      target: { value: "2028-01-01" },
    });
    expect(screen.getByLabelText("Année d’affiliation")).toHaveValue(2028);
    expect(screen.getByLabelText("Fin de validité incluse")).toHaveValue(
      "2028-12-31",
    );
    fireEvent.change(screen.getByLabelText("Début de validité"), {
      target: { value: "2028-03-01" },
    });
    expect(screen.getByLabelText("Fin de validité incluse")).toHaveValue(
      "2029-03-01",
    );
  });
  it("prépare l’identité interne avant de configurer un dossier historique", async () => {
    view({ dues: null, card: { ...card, snapshot: null } });
    fireEvent.click(
      screen.getByRole("button", { name: "Configurer les droits" }),
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Enregistrer la période" })
        .closest("form")!,
    );
    await waitFor(() => expect(mocks.establish).toHaveBeenCalledTimes(1));
    expect(mocks.prepare).toHaveBeenCalledWith("card-a");
    expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.establish.mock.invocationCallOrder[0],
    );
  });
  it("demande un barème existant sans inventer de montant ni de durée", () => {
    view({ dues: null, tariffs: [] });
    fireEvent.click(
      screen.getByRole("button", { name: "Configurer les droits" }),
    );
    expect(screen.getByText(/Aucun barème ne correspond/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Configurer les barèmes d’adhésion" }),
    ).toHaveAttribute("href", "/artisan-minier/cartes/suivi?onglet=baremes");
    expect(
      screen.queryByRole("button", { name: "Enregistrer la période" }),
    ).not.toBeInTheDocument();
    expect(mocks.establish).not.toHaveBeenCalled();
  });
  it("enregistre l’année, la date, le lieu et la preuve avec le paiement après dépôt du fichier", async () => {
    view();
    const form = openPayment();
    expect(within(form).getByLabelText("Année d’affiliation")).toHaveValue(
      "2026",
    );
    expect(within(form).getByLabelText("Année d’affiliation")).toHaveAttribute(
      "readonly",
    );
    expect(within(form).getByLabelText("Date de paiement")).toHaveAttribute(
      "max",
      "2026-09-06",
    );
    const file = fillPayment(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
    const id = mocks.record.mock.calls[0][0].p_id;
    expect(mocks.upload).toHaveBeenCalledWith(file, "dues-a", id);
    expect(mocks.record).toHaveBeenCalledWith({
      p_id: id,
      p_droit: "dues-a",
      p_montant: 10000,
      p_reference: "TEST-RECU-2026",
      p_mode: "virement_bancaire",
      p_date: "2026-09-05",
      p_annee: 2026,
      p_lieu: "Caisse Ouagadougou",
      p_preuve: "dues-a/receipt-a/proof.pdf",
    });
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.record.mock.invocationCallOrder[0],
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("form", {
          name: "Enregistrer les droits d’affiliation",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("ne crée pas d’encaissement sans justificatif et refuse un fichier invalide", async () => {
    view();
    const form = openPayment();
    expect(
      within(form).getByRole("button", { name: "Enregistrer le paiement" }),
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(mocks.run).not.toHaveBeenCalled();
    fillPayment(
      form,
      new File(["script"], "preuve.html", { type: "text/html" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Joignez un PDF, JPG ou PNG de 5 Mo maximum.",
    );
    expect(
      within(form).getByRole("button", { name: "Enregistrer le paiement" }),
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(mocks.upload).not.toHaveBeenCalled();
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", {
      type: "application/pdf",
    });
    fillPayment(form, large);
    expect(
      within(form).getByRole("button", { name: "Enregistrer le paiement" }),
    ).toBeDisabled();
    fillPayment(form);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      within(form).getByRole("button", { name: "Enregistrer le paiement" }),
    ).toBeEnabled();
  });
  it("conserve les données et la clé d’idempotence lors d’un échec puis d’une reprise", async () => {
    mocks.record.mockRejectedValueOnce(new Error("réseau indisponible"));
    view();
    const form = openPayment();
    fillPayment(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.errors).toHaveLength(1));
    expect(
      screen.getByRole("form", {
        name: "Enregistrer les droits d’affiliation",
      }),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText("Lieu de paiement")).toHaveValue(
      "Caisse Ouagadougou",
    );
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(2));
    expect(mocks.record.mock.calls[0][0]).toEqual(
      mocks.record.mock.calls[1][0],
    );
    expect(mocks.upload.mock.calls[0][2]).toBe(mocks.upload.mock.calls[1][2]);
  });
  it("ne crée aucun paiement si le dépôt du justificatif échoue", async () => {
    mocks.upload.mockRejectedValue(new Error("dépôt indisponible"));
    view();
    const form = openPayment();
    fillPayment(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.errors).toHaveLength(1));
    expect(mocks.record).not.toHaveBeenCalled();
    expect(
      screen.getByRole("form", {
        name: "Enregistrer les droits d’affiliation",
      }),
    ).toBeInTheDocument();
  });
  it("désactive toute saisie pendant une opération et ignore un nouvel envoi", () => {
    const { rerender } = view();
    const form = openPayment();
    fillPayment(form);
    rerender(panel({ busy: true }));
    expect(within(form).getByLabelText("Lieu de paiement")).toBeDisabled();
    expect(within(form).getByLabelText(/Preuve de paiement/)).toBeDisabled();
    expect(
      within(form).getByRole("button", { name: "Enregistrer le paiement" }),
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("limite le montant au solde non réservé, sans compter l’attente comme un paiement confirmé", () => {
    view({
      receipts: [
        receipt({ id: "partial", montant: 3000, statut: "confirme" }),
        receipt({ id: "pending", montant: 2000 }),
      ],
    });
    expect(screen.getByText("Paiement à confirmer")).toBeInTheDocument();
    const form = openPayment();
    expect(within(form).getByLabelText("Montant (FCFA)")).toHaveValue(5000);
    expect(within(form).getByLabelText("Montant (FCFA)")).toHaveAttribute(
      "max",
      "5000",
    );
    expect(screen.queryByText("Droits payés")).not.toBeInTheDocument();
  });
  it("bloque un second règlement lorsque le montant complet est déjà en attente", () => {
    view({ receipts: [receipt()] });
    expect(screen.getByText("Paiement à confirmer")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enregistrer un paiement" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Droits payés")).not.toBeInTheDocument();
  });
  it("réserve la confirmation à un autre agent habilité", () => {
    const { rerender } = view({ receipts: [receipt()], userId: "cashier" });
    expect(
      screen.getByRole("button", { name: "Confirmer le paiement" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/confirmé par un autre agent habilité/),
    ).toBeInTheDocument();
    rerender(panel({ receipts: [receipt()], userId: "reviewer" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer le paiement" }),
    );
    expect(mocks.confirm).toHaveBeenCalledWith("receipt-a");
    rerender(panel({ receipts: [receipt()], confirm: false }));
    expect(
      screen.queryByRole("button", { name: "Confirmer le paiement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Réviser l’encaissement"),
    ).not.toBeInTheDocument();
  });
  it("permet de consulter la preuve privée et ferme l’onglet si la signature échoue", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    view({ receipts: [receipt()], manage: false, confirm: false });
    fireEvent.click(
      screen.getByRole("button", { name: "Consulter la preuve" }),
    );
    await waitFor(() =>
      expect(popup.location.href).toBe("https://private.example.test/proof"),
    );
    expect(mocks.signedProof).toHaveBeenCalledWith(
      "dues-a/receipt-a/proof.pdf",
    );
    expect(popup.opener).toBeNull();
    mocks.signedProof.mockRejectedValueOnce(new Error("accès refusé"));
    fireEvent.click(
      screen.getByRole("button", { name: "Consulter la preuve" }),
    );
    await waitFor(() => expect(popup.close).toHaveBeenCalledTimes(1));
  });
  it("ne demande pas d’URL privée lorsqu’un navigateur bloque l’ouverture", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    view({ receipts: [receipt()] });
    fireEvent.click(
      screen.getByRole("button", { name: "Consulter la preuve" }),
    );
    await waitFor(() => expect(mocks.errors).toHaveLength(1));
    expect(mocks.signedProof).not.toHaveBeenCalled();
  });
  it("masque les actions de modification sans habilitation de gestion", () => {
    const { rerender } = view({ dues: null, manage: false, confirm: false });
    expect(
      screen.queryByRole("button", { name: "Configurer les droits" }),
    ).not.toBeInTheDocument();
    rerender(panel({ manage: false, confirm: false }));
    expect(
      screen.queryByRole("button", { name: "Enregistrer un paiement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Annuler cette échéance"),
    ).not.toBeInTheDocument();
  });
  it("révise un encaissement confirmé avec un motif explicite et recalcule son état via le service", async () => {
    view({ receipts: [receipt({ statut: "confirme" })] });
    expect(screen.getByText("Droits payés")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enregistrer un paiement" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Décision" }), {
      target: { value: "rembourse" },
    });
    fireEvent.change(screen.getByLabelText("Motif"), {
      target: { value: "Remboursement du paiement erroné" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Confirmer la révision" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(mocks.review).toHaveBeenCalledWith(
        "receipt-a",
        "rembourse",
        "Remboursement du paiement erroné",
      ),
    );
  });
});
