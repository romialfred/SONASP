import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtisanDossierSummary } from "./ArtisanDossierSummary";
import { valuesFromArtisan } from "@/lib/artisanDossier";
vi.mock("@/services/artisanDocumentService", () => ({
  artisanDocumentService: {
    list: async () => [
      {
        id: "doc",
        owner_kind: "responsable",
        titre: "Passeport du responsable",
        type_document: "passeport",
        taille_fichier: 100,
      },
    ],
    url: vi.fn(),
  },
}));
vi.mock("@/services/artisanDossierService", () => ({
  artisanDossierService: {
    getExploitant: async () => ({
      nom: "Parent",
      prenoms: "Artisan",
      type_personne: "physique",
      site_name: "Site hérité",
    }),
  },
}));
describe("fiche complète société", () => {
  it("restitue les identifiants, le siège, le responsable et ses pièces", async () => {
    const v = valuesFromArtisan(null);
    render(
      <ArtisanDossierSummary
        artisan={{
          id: "s1",
          numero_carte: null,
          type_personne: "morale",
          type_artisan: "aide_exploitant",
          telephone: "+22670000000",
          raison_sociale: "Société témoin",
          numero_registre_commerce: "000-RCCM",
          numero_ifu: "000-IFU",
          siege_adresse: "Adresse du siège",
          adresse: "Adresse activité",
          exploitant_id: "p1",
          responsable: {
            ...v.responsable,
            nom: "Nom responsable",
            prenoms: "Prénom",
            date_naissance: "1980-01-01",
            telephone: "+22670000001",
            whatsapp: "+22670000002",
            fonction: "Gérante",
            numero_piece_identite: "P-009",
          },
        }}
      />,
    );
    expect(screen.getByText("000-IFU")).toBeInTheDocument();
    expect(screen.getByText("Gérante")).toBeInTheDocument();
    expect(screen.getByText("+22670000002")).toBeInTheDocument();
    expect(screen.getByText("P-009")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Passeport du responsable")).toBeInTheDocument(),
    );
    expect(screen.getByText("Site hérité")).toBeInTheDocument();
  });
});
