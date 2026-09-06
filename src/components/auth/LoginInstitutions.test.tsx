import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginInstitutions } from "./LoginInstitutions";

describe("bandeau des institutions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("présente cinq institutions accessibles, sans commandes de défilement", () => {
    const { container } = render(<LoginInstitutions />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /pause|reprendre|suivantes|précédentes/i })).not.toBeInTheDocument();
    const groups = container.querySelectorAll(".login-institutions__group");
    expect(groups).toHaveLength(2);
    expect(groups[1].textContent).toBe(groups[0].textContent);
    expect(groups[1]).toHaveAttribute("aria-hidden", "true");
    groups[1].querySelectorAll("button").forEach((button) => expect(button.tabIndex).toBe(-1));
  });

  it("ouvre la définition au survol, permet de la parcourir et ferme avec Échap", () => {
    render(<LoginInstitutions />);
    const sonasp = screen.getByRole("button", { name: "À propos de SONASP" });
    fireEvent.mouseEnter(sonasp);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Société Nationale des Substances Précieuses");
    expect(sonasp).toHaveAttribute("aria-describedby", "login-institution-definition");
    fireEvent.mouseLeave(screen.getByRole("region"));
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(sonasp, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("garde une fiche fixe ouverte pendant la lecture et la ferme au clic extérieur", () => {
    render(<LoginInstitutions />);
    const bumigeb = screen.getByRole("button", { name: "À propos de BUMIGEB" });
    fireEvent.focus(bumigeb);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Service géologique national");
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(bumigeb);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("ouvre aussi les définitions depuis la copie visuelle de la boucle", () => {
    const { container } = render(<LoginInstitutions />);
    const copy = container.querySelector('.login-institutions__group[aria-hidden="true"] [data-institution="sonasp"]')!;
    fireEvent.mouseEnter(copy);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Société Nationale des Substances Précieuses");
    fireEvent.mouseLeave(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
