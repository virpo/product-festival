import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizerHeader } from "./OrganizerHeader";

describe("OrganizerHeader", () => {
  it("keeps the event state and logout available in the admin header", () => {
    const onSignOut = vi.fn();

    render(
      <OrganizerHeader
        eventStatus="open"
        name="Peter"
        onSignOut={onSignOut}
      />,
    );

    expect(screen.getByText("Investovanie beží")).toBeInTheDocument();
    expect(screen.getByText("Peter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Odhlásiť sa" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("uses the left slot as a visible return from QR sheets", () => {
    render(
      <OrganizerHeader
        back={{ href: "/admin", label: "Administrácia" }}
        eventStatus="draft"
        name="Peter"
        onSignOut={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Späť na Administrácia" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByLabelText("Product Festival")).toBeInTheDocument();
  });
});
