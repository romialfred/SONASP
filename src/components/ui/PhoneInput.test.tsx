import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhoneInput } from "./PhoneInput";
function Field({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneInput value={value} onChange={setValue} required />
      <output aria-label="Numéro complet">{value}</output>
    </>
  );
}
describe("téléphone international", () => {
  it("conserve un indicatif étranger et accepte le numéro complet", () => {
    render(<Field initial="+33612345678" />);
    expect(screen.getByLabelText("Téléphone")).toHaveValue("+33612345678");
    expect(screen.getByLabelText("Indicatif téléphone")).toHaveValue("");
    expect(screen.getByLabelText("Indicatif téléphone")).not.toBeRequired();
    fireEvent.change(screen.getByLabelText("Téléphone"), {
      target: { value: "+33123456789" },
    });
    expect(screen.getByLabelText("Numéro complet")).toHaveTextContent(
      "+33123456789",
    );
  });
  it("vide réellement le numéro sans garder un indicatif seul", () => {
    render(<Field initial="+223 70000001" />);
    fireEvent.change(screen.getByLabelText("Téléphone"), {
      target: { value: "" },
    });
    expect(screen.getByLabelText("Téléphone")).toHaveValue("");
    expect(screen.getByLabelText("Numéro complet")).toBeEmptyDOMElement();
  });
});
