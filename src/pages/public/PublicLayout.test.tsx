import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicLayout from "./PublicLayout";

function renderLayout() {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<div>Accueil de test</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
describe("navigation publique présidentielle", () => {
  beforeEach(() => {
    window.localStorage.setItem("sonasp-language", "fr");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });
  it("relie les quatre sections, l’accès habilité et les informations légales", () => {
    renderLayout();
    const header = screen.getByRole("banner");
    const nav = within(header).getByRole("navigation", {
      name: "Navigation principale",
    });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "La plateforme",
      "Les portails",
      "La traçabilité",
      "Impact national",
    ]);
    expect(
      within(header).getByRole("link", { name: "Faso SANAMA — Accueil" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(header).getByRole("link", { name: /Accéder à mon espace/ }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(header).getByRole("img", { name: "Faso SANAMA" }),
    ).toHaveAttribute("src", "/login-faso/faso-sanama.png");
    expect(screen.getByLabelText("Langue : français")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    for (const [label, href] of [
      ["Assistance", "/assistance"],
      ["Mentions légales", "/mentions-legales"],
      ["Politique de confidentialité", "/confidentialite"],
    ]) {
      expect(within(footer).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(footer).toHaveTextContent("Présidence du Burkina Faso");
    expect(footer).toHaveTextContent("Quantix Solutions Burkina Faso");
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  });
  it("ouvre le menu mobile au clavier, boucle le focus et ferme sur Échap", () => {
    renderLayout();
    const menuButton = screen.getByLabelText("Ouvrir le menu");
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Navigation mobile" });
    const links = within(nav).getAllByRole("link");
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(menuButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(links.at(-1)).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(menuButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("ferme la navigation après la sélection d’une section", () => {
    renderLayout();
    fireEvent.click(screen.getByLabelText("Ouvrir le menu"));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Navigation mobile" }),
      ).getByRole("link", { name: "Les portails" }),
    );
    expect(
      screen.queryByRole("navigation", { name: "Navigation mobile" }),
    ).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
