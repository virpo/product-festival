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

  it("puts a print class on the sticky header itself, not a wrapper", () => {
    const { container } = render(
      <OrganizerHeader
        className="no-print"
        eventStatus="open"
        name="Peter"
        onSignOut={vi.fn()}
      />,
    );

    // A wrapper element would become the sticky header's containing block and
    // stop it from travelling with the page on /admin/qr.
    const header = container.querySelector("header");
    expect(header).toHaveClass("festival-header", "no-print");
    expect(container.firstElementChild).toBe(header);
  });
});
