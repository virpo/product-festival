import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InitialLoadState } from "./InitialLoadState";

describe("InitialLoadState", () => {
  it("renders the route-specific loading label", () => {
    render(
      <InitialLoadState
        error=""
        label="Zapínam skener…"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Zapínam skener…")).toBeInTheDocument();
  });

  it("turns an initial load failure into a retry action", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <InitialLoadState
        error="Nepodarilo sa načítať dáta."
        label="Načítavam…"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nepodarilo sa načítať dáta.",
    );
    await user.click(screen.getByRole("button", { name: "Skúsiť znova" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("can fill the projector wall", () => {
    render(
      <InitialLoadState
        error=""
        label="Pripájam živé dáta…"
        onRetry={vi.fn()}
        variant="wall"
      />,
    );

    expect(screen.getByRole("status")).toHaveClass(
      "initial-load--wall",
    );
  });
});
